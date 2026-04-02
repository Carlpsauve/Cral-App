-- ============================================================
-- CRAL Migration v4
-- Équipes · Transactions en attente · Blackjack · GeoGuessr · Avatar SVG
-- Idempotent — peut être exécuté plusieurs fois sans erreur
-- ============================================================

-- 1. Équipes dans bet_participants
ALTER TABLE public.bet_participants
  ADD COLUMN IF NOT EXISTS team TEXT CHECK (team IN ('A', 'B'));

-- 2. Transaction type bet_pending + bet_refund
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'bet_win','bet_loss','bet_pending','bet_refund',
    'daily_win','daily_loss','daily_free_win',
    'blackjack_win','blackjack_loss',
    'admin_credit','admin_debit','signup_bonus','hbc_upgrade'
  ));

-- 3. Avatar SVG dans profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_svg TEXT;

-- 4. Table blackjack_sessions (résultats casino du jour)
CREATE TABLE IF NOT EXISTS public.casino_sessions (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  session_date  DATE NOT NULL,
  game          TEXT NOT NULL CHECK (game IN ('blackjack', 'slot')),
  total_won     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.casino_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_select" ON public.casino_sessions;
DROP POLICY IF EXISTS "cs_insert" ON public.casino_sessions;
CREATE POLICY "cs_select" ON public.casino_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cs_insert" ON public.casino_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cs_user_date_game ON public.casino_sessions(user_id, session_date, game);

-- 6. Fonction resolve_bet mise à jour pour les équipes
CREATE OR REPLACE FUNCTION public.resolve_bet_team(p_bet_id UUID, p_winning_team TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet          RECORD;
  v_participant  RECORD;
  v_total_pool   NUMERIC;
  v_winner_count INTEGER;
  v_share        NUMERIC;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet % not found', p_bet_id; END IF;
  IF v_bet.status IN ('resolved','cancelled') THEN RAISE EXCEPTION 'Bet already %', v_bet.status; END IF;

  -- Count all accepted participants and winners
  SELECT COUNT(*) INTO v_winner_count
  FROM public.bet_participants
  WHERE bet_id = p_bet_id AND accepted = true AND team = p_winning_team;

  IF v_winner_count = 0 THEN RAISE EXCEPTION 'No accepted participants in winning team'; END IF;

  SELECT COUNT(*) * v_bet.amount INTO v_total_pool
  FROM public.bet_participants WHERE bet_id = p_bet_id AND accepted = true;

  v_share := ROUND(v_total_pool / v_winner_count, 2);

  -- Deduct from all participants (losers keep their bet_loss tx from acceptance)
  -- Credit winners their share
  FOR v_participant IN
    SELECT user_id, team FROM public.bet_participants WHERE bet_id = p_bet_id AND accepted = true
  LOOP
    IF v_participant.team = p_winning_team THEN
      UPDATE public.profiles SET balance = balance + v_share WHERE id = v_participant.user_id;
      INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
      VALUES (v_participant.user_id, v_share, 'bet_win', 'Gajure gagnée (Équipe ' || p_winning_team || '): ' || v_bet.title, p_bet_id);
    ELSE
      INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
      VALUES (v_participant.user_id, 0, 'bet_loss', 'Gajure perdue (Équipe ' || v_participant.team || '): ' || v_bet.title, p_bet_id);
    END IF;
  END LOOP;

  UPDATE public.bets SET status = 'resolved', resolved_at = NOW() WHERE id = p_bet_id;
END;
$$;

-- Realtime for casino_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_sessions;
