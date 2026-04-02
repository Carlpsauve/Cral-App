-- ============================================================
-- CRAL Migration v6
-- Paris sportifs — matchs, cotes, paris des joueurs
-- Idempotent
-- ============================================================

-- Sports matches cache (from The Odds API)
CREATE TABLE IF NOT EXISTS public.sport_matches (
  id            TEXT PRIMARY KEY, -- Odds API event ID
  sport_key     TEXT NOT NULL,    -- e.g. 'icehockey_nhl'
  sport_label   TEXT NOT NULL,    -- e.g. 'NHL'
  home_team     TEXT NOT NULL,
  away_team     TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','finished','cancelled')),
  home_score    INTEGER,
  away_score    INTEGER,
  winner        TEXT,             -- 'home', 'away', or 'draw'
  odds_home     NUMERIC(8,4),     -- decimal odds e.g. 2.10
  odds_away     NUMERIC(8,4),
  odds_draw     NUMERIC(8,4),     -- null for sports with no draw
  odds_updated  TIMESTAMPTZ,
  result_checked BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sport_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sm_select" ON public.sport_matches;
CREATE POLICY "sm_select" ON public.sport_matches FOR SELECT USING (true);
DROP POLICY IF EXISTS "sm_insert" ON public.sport_matches;
CREATE POLICY "sm_insert" ON public.sport_matches FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "sm_update" ON public.sport_matches;
CREATE POLICY "sm_update" ON public.sport_matches FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_sm_sport     ON public.sport_matches(sport_key);
CREATE INDEX IF NOT EXISTS idx_sm_status    ON public.sport_matches(status);
CREATE INDEX IF NOT EXISTS idx_sm_commence  ON public.sport_matches(commence_time);

-- Player sport bets
CREATE TABLE IF NOT EXISTS public.sport_bets (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  match_id   TEXT REFERENCES public.sport_matches(id) ON DELETE CASCADE NOT NULL,
  pick       TEXT NOT NULL CHECK (pick IN ('home','away','draw')),
  amount     NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  odds       NUMERIC(8,4) NOT NULL,  -- decimal odds at time of bet
  potential_win NUMERIC(12,2) NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','cancelled','push')),
  payout     NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(user_id, match_id) -- one bet per match per user
);

ALTER TABLE public.sport_bets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sb_select" ON public.sport_bets;
CREATE POLICY "sb_select" ON public.sport_bets FOR SELECT USING (true);
DROP POLICY IF EXISTS "sb_insert" ON public.sport_bets;
CREATE POLICY "sb_insert" ON public.sport_bets FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "sb_update" ON public.sport_bets;
CREATE POLICY "sb_update" ON public.sport_bets FOR UPDATE USING (auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

CREATE INDEX IF NOT EXISTS idx_sb_user    ON public.sport_bets(user_id);
CREATE INDEX IF NOT EXISTS idx_sb_match   ON public.sport_bets(match_id);
CREATE INDEX IF NOT EXISTS idx_sb_status  ON public.sport_bets(status);

-- Add sport_bet transaction types
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'bet_win','bet_loss','bet_pending','bet_refund',
    'daily_win','daily_loss','daily_free_win',
    'blackjack_win','blackjack_loss',
    'sport_bet_win','sport_bet_loss','sport_bet_refund',
    'admin_credit','admin_debit','signup_bonus','hbc_upgrade'
  ));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.sport_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sport_bets;

-- Function to resolve sport bets for a match
CREATE OR REPLACE FUNCTION public.resolve_sport_bets(p_match_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_match   RECORD;
  v_bet     RECORD;
  v_payout  NUMERIC;
  v_count   INTEGER := 0;
BEGIN
  SELECT * INTO v_match FROM public.sport_matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.winner IS NULL THEN RETURN 0; END IF;

  FOR v_bet IN
    SELECT * FROM public.sport_bets WHERE match_id = p_match_id AND status = 'pending'
  LOOP
    IF v_match.status = 'cancelled' THEN
      -- Refund
      UPDATE public.profiles SET balance = balance + v_bet.amount WHERE id = v_bet.user_id;
      UPDATE public.sport_bets SET status = 'cancelled', payout = v_bet.amount, resolved_at = NOW() WHERE id = v_bet.id;
      INSERT INTO public.transactions (user_id, amount, type, description)
        VALUES (v_bet.user_id, v_bet.amount, 'sport_bet_refund',
          'Pari sportif annulé — remboursement');

    ELSIF v_bet.pick = v_match.winner THEN
      -- Won
      v_payout := ROUND(v_bet.amount * v_bet.odds, 2);
      UPDATE public.profiles SET balance = balance + v_payout WHERE id = v_bet.user_id;
      UPDATE public.sport_bets SET status = 'won', payout = v_payout, resolved_at = NOW() WHERE id = v_bet.id;
      INSERT INTO public.transactions (user_id, amount, type, description)
        VALUES (v_bet.user_id, v_payout - v_bet.amount, 'sport_bet_win',
          'Pari sportif gagné: ' || v_match.home_team || ' vs ' || v_match.away_team);

    ELSE
      -- Lost
      UPDATE public.sport_bets SET status = 'lost', payout = 0, resolved_at = NOW() WHERE id = v_bet.id;
      INSERT INTO public.transactions (user_id, amount, type, description)
        VALUES (v_bet.user_id, -v_bet.amount, 'sport_bet_loss',
          'Pari sportif perdu: ' || v_match.home_team || ' vs ' || v_match.away_team);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.sport_matches SET result_checked = true WHERE id = p_match_id;
  RETURN v_count;
END;
$$;
