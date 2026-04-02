-- ============================================================
-- CRAL APP — Supabase Schema (version finale)
-- Exécutez dans l'éditeur SQL de Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  email        TEXT NOT NULL,
  balance      NUMERIC(12,2) NOT NULL DEFAULT 100.00 CHECK (balance >= 0),
  role         TEXT NOT NULL DEFAULT 'plebe' CHECK (role IN ('super_admin','plebe')),
  avatar_color TEXT NOT NULL DEFAULT '#fbbf24',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE INDEX idx_profiles_role ON public.profiles(role);

-- ============================================================
-- BETS
-- ============================================================
CREATE TABLE public.bets (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description TEXT,
  creator_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','voting','resolved','cancelled')),
  winner_id   UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bets_select"  ON public.bets FOR SELECT USING (true);
CREATE POLICY "bets_insert"  ON public.bets FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "bets_update"  ON public.bets FOR UPDATE USING (
  auth.uid() = creator_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin') OR
  EXISTS (SELECT 1 FROM public.bet_participants WHERE bet_id = bets.id AND user_id = auth.uid() AND accepted = true)
);

CREATE INDEX idx_bets_creator   ON public.bets(creator_id);
CREATE INDEX idx_bets_status    ON public.bets(status);
CREATE INDEX idx_bets_created   ON public.bets(created_at DESC);

-- ============================================================
-- BET PARTICIPANTS
-- ============================================================
CREATE TABLE public.bet_participants (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bet_id     UUID REFERENCES public.bets(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  accepted   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bet_id, user_id)
);

ALTER TABLE public.bet_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bp_select" ON public.bet_participants FOR SELECT USING (true);
CREATE POLICY "bp_insert" ON public.bet_participants FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT creator_id FROM public.bets WHERE id = bet_id)
  OR auth.uid() = user_id
);
CREATE POLICY "bp_update" ON public.bet_participants FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_bp_bet_id  ON public.bet_participants(bet_id);
CREATE INDEX idx_bp_user_id ON public.bet_participants(user_id);

-- ============================================================
-- BET VOTES
-- ============================================================
CREATE TABLE public.bet_votes (
  id            UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bet_id        UUID REFERENCES public.bets(id) ON DELETE CASCADE NOT NULL,
  voter_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  voted_for_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bet_id, voter_id)
);

ALTER TABLE public.bet_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bv_select" ON public.bet_votes FOR SELECT USING (true);
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

CREATE INDEX idx_bv_bet_id ON public.bet_votes(bet_id);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  type         TEXT NOT NULL CHECK (
    type IN ('bet_win','bet_loss','daily_win','daily_loss','admin_credit','admin_debit','signup_bonus')
  ),
  description  TEXT NOT NULL,
  reference_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tx_select" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT WITH CHECK (true);

CREATE INDEX idx_tx_user_id   ON public.transactions(user_id);
CREATE INDEX idx_tx_created   ON public.transactions(created_at DESC);
CREATE INDEX idx_tx_type      ON public.transactions(type);

-- ============================================================
-- DAILY PLAYS
-- ============================================================
CREATE TABLE public.daily_plays (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  played_date  DATE NOT NULL,
  lines_played INTEGER NOT NULL CHECK (lines_played BETWEEN 1 AND 5),
  bet_per_line NUMERIC(12,2) NOT NULL CHECK (bet_per_line BETWEEN 0.50 AND 10.00),
  total_bet    NUMERIC(12,2) NOT NULL,
  result       JSONB NOT NULL,
  total_win    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, played_date)
);

ALTER TABLE public.daily_plays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dp_select" ON public.daily_plays FOR SELECT USING (true);
CREATE POLICY "dp_insert" ON public.daily_plays FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_dp_user_date ON public.daily_plays(user_id, played_date DESC);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  colors TEXT[] := ARRAY[
    '#fbbf24','#f87171','#34d399','#60a5fa',
    '#a78bfa','#fb7185','#38bdf8','#4ade80',
    '#f97316','#e879f9','#2dd4bf','#facc15'
  ];
  chosen_color TEXT;
  chosen_username TEXT;
BEGIN
  chosen_color    := colors[1 + floor(random() * array_length(colors, 1))::int];
  chosen_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, username, email, balance, role, avatar_color)
  VALUES (NEW.id, chosen_username, NEW.email, 100.00, 'plebe', chosen_color)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (NEW.id, 100.00, 'signup_bonus', 'Bonus de bienvenue — ₡100 Cral dollars');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Resolve bet: atomic money transfer
CREATE OR REPLACE FUNCTION public.resolve_bet(p_bet_id UUID, p_winner_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet           RECORD;
  v_participant   RECORD;
  v_count         INTEGER;
  v_total_pool    NUMERIC;
  v_actual_debit  NUMERIC;
BEGIN
  -- Lock and fetch the bet
  SELECT * INTO v_bet
  FROM public.bets
  WHERE id = p_bet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet % not found', p_bet_id;
  END IF;

  IF v_bet.status IN ('resolved','cancelled') THEN
    RAISE EXCEPTION 'Bet already % ', v_bet.status;
  END IF;

  -- Count accepted participants
  SELECT COUNT(*) INTO v_count
  FROM public.bet_participants
  WHERE bet_id = p_bet_id AND accepted = true;

  IF v_count < 2 THEN
    RAISE EXCEPTION 'Need at least 2 accepted participants';
  END IF;

  -- Verify winner is a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.bet_participants
    WHERE bet_id = p_bet_id AND user_id = p_winner_id AND accepted = true
  ) THEN
    RAISE EXCEPTION 'Winner is not an accepted participant';
  END IF;

  v_total_pool := v_bet.amount * v_count;

  -- Deduct from each participant (floor at 0)
  FOR v_participant IN
    SELECT user_id
    FROM public.bet_participants
    WHERE bet_id = p_bet_id AND accepted = true
  LOOP
    SELECT GREATEST(0, balance - v_bet.amount) INTO v_actual_debit
    FROM public.profiles WHERE id = v_participant.user_id;

    UPDATE public.profiles
    SET balance = GREATEST(0, balance - v_bet.amount)
    WHERE id = v_participant.user_id;

    INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
    VALUES (
      v_participant.user_id,
      -v_bet.amount,
      'bet_loss',
      'Gajure perdue: ' || v_bet.title,
      p_bet_id
    );
  END LOOP;

  -- Credit winner
  UPDATE public.profiles
  SET balance = balance + v_total_pool
  WHERE id = p_winner_id;

  INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
  VALUES (p_winner_id, v_total_pool, 'bet_win', 'Gajure gagnée: ' || v_bet.title, p_bet_id);

  -- Mark resolved
  UPDATE public.bets
  SET status = 'resolved', winner_id = p_winner_id, resolved_at = NOW()
  WHERE id = p_bet_id;

END;
$$;

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_plays;
