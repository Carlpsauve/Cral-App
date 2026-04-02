-- ============================================================
-- CRAL Migration v3
-- Prédictions sur gajures · Annulation avec remboursement
-- Idempotent — peut être exécuté plusieurs fois sans erreur
-- ============================================================

-- 1. Champ prédiction dans bet_participants
ALTER TABLE public.bet_participants ADD COLUMN IF NOT EXISTS prediction TEXT;

-- 2. Table des votes d'annulation
CREATE TABLE IF NOT EXISTS public.bet_cancel_votes (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bet_id     UUID REFERENCES public.bets(id) ON DELETE CASCADE NOT NULL,
  voter_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bet_id, voter_id)
);

ALTER TABLE public.bet_cancel_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bcv_select" ON public.bet_cancel_votes;
CREATE POLICY "bcv_select" ON public.bet_cancel_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "bcv_insert" ON public.bet_cancel_votes;
CREATE POLICY "bcv_insert" ON public.bet_cancel_votes FOR INSERT WITH CHECK (
  auth.uid() = voter_id AND
  EXISTS (
    SELECT 1 FROM public.bet_participants
    WHERE bet_id = bet_cancel_votes.bet_id AND user_id = auth.uid() AND accepted = true
  )
);

CREATE INDEX IF NOT EXISTS idx_bcv_bet_id ON public.bet_cancel_votes(bet_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_cancel_votes;

-- 3. Fonction : annuler et rembourser
CREATE OR REPLACE FUNCTION public.cancel_bet_refund(p_bet_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet         RECORD;
  v_participant RECORD;
BEGIN
  SELECT * INTO v_bet FROM public.bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet % not found', p_bet_id; END IF;
  IF v_bet.status IN ('resolved', 'cancelled') THEN RAISE EXCEPTION 'Bet already %', v_bet.status; END IF;

  FOR v_participant IN
    SELECT user_id FROM public.bet_participants WHERE bet_id = p_bet_id AND accepted = true
  LOOP
    UPDATE public.profiles SET balance = balance + v_bet.amount WHERE id = v_participant.user_id;
    INSERT INTO public.transactions (user_id, amount, type, description, reference_id)
    VALUES (v_participant.user_id, v_bet.amount, 'admin_credit', 'Gajure annulée — remboursement: ' || v_bet.title, p_bet_id);
  END LOOP;

  UPDATE public.bets SET status = 'cancelled' WHERE id = p_bet_id;
END;
$$;
