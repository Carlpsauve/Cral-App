-- ============================================================
-- CRAL Migration v5
-- Gajures par équipes — colonne is_team_bet
-- Idempotent
-- ============================================================

ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS is_team_bet BOOLEAN NOT NULL DEFAULT false;

-- Column to store winning team (for team bets)
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS winner_team TEXT CHECK (winner_team IN ('A', 'B'));

-- Update resolve_bet_team to also set winner_team
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

  SELECT COUNT(*) INTO v_winner_count
  FROM public.bet_participants
  WHERE bet_id = p_bet_id AND accepted = true AND team = p_winning_team;

  IF v_winner_count = 0 THEN RAISE EXCEPTION 'No accepted participants in winning team'; END IF;

  SELECT COUNT(*) * v_bet.amount INTO v_total_pool
  FROM public.bet_participants WHERE bet_id = p_bet_id AND accepted = true;

  v_share := ROUND(v_total_pool / v_winner_count, 2);

  -- Credit winners, record transactions for all
  FOR v_participant IN
    SELECT user_id, team FROM public.bet_participants WHERE bet_id = p_bet_id AND accepted = true
  LOOP
    IF v_participant.team = p_winning_team THEN
      UPDATE public.profiles SET balance = balance + v_share WHERE id = v_participant.user_id;
      INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
      VALUES (v_participant.user_id, v_share, 'bet_win',
        'Gajure gagnée (Équipe ' || p_winning_team || '): ' || v_bet.title, p_bet_id);
    ELSE
      INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
      VALUES (v_participant.user_id, 0, 'bet_loss',
        'Gajure perdue (Équipe ' || v_participant.team || '): ' || v_bet.title, p_bet_id);
    END IF;
  END LOOP;

  UPDATE public.bets
  SET status = 'resolved', winner_team = p_winning_team, resolved_at = NOW()
  WHERE id = p_bet_id;
END;
$$;

-- Update bet_votes INSERT policy to allow team votes ('A'/'B')
DROP POLICY IF EXISTS "bv_insert" ON public.bet_votes;
CREATE POLICY "bv_insert" ON public.bet_votes FOR INSERT WITH CHECK (
  auth.uid() = voter_id AND
  EXISTS (
    SELECT 1 FROM public.bet_participants
    WHERE bet_id = bet_votes.bet_id
      AND user_id = auth.uid()
      AND accepted = true
  ) AND
  EXISTS (
    SELECT 1 FROM public.bets
    WHERE id = bet_votes.bet_id
      AND status = 'voting'
  )
);

-- Blackjack session state (server-side game state)
CREATE TABLE IF NOT EXISTS public.blackjack_sessions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  bet         NUMERIC(12,2) NOT NULL,
  deck        JSONB NOT NULL,
  player_hand JSONB NOT NULL,
  dealer_hand JSONB NOT NULL, -- only first card visible to client
  status      TEXT NOT NULL DEFAULT 'playing' CHECK (status IN ('playing','resolved')),
  result      TEXT,
  net_gain    NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.blackjack_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bjs_all" ON public.blackjack_sessions;
CREATE POLICY "bjs_all" ON public.blackjack_sessions FOR ALL USING (auth.uid() = user_id);

-- Add split_hand and active_hand columns to blackjack_sessions
ALTER TABLE public.blackjack_sessions ADD COLUMN IF NOT EXISTS split_hand JSONB;
ALTER TABLE public.blackjack_sessions ADD COLUMN IF NOT EXISTS active_hand INTEGER DEFAULT 1;
ALTER TABLE public.blackjack_sessions ADD COLUMN IF NOT EXISTS hand1_result TEXT;
ALTER TABLE public.blackjack_sessions ADD COLUMN IF NOT EXISTS hand1_net NUMERIC(12,2);

-- Daily fortune wheel
CREATE TABLE IF NOT EXISTS public.daily_wheel (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  played_date DATE NOT NULL,
  reward      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, played_date)
);
ALTER TABLE public.daily_wheel ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dw_all" ON public.daily_wheel;
CREATE POLICY "dw_all" ON public.daily_wheel FOR ALL USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_wheel;
