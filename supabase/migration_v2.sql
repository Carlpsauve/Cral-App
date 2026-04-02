-- ============================================================
-- CRAL Migration v2
-- HBC role · Free bet · RLS fixes · Admin permissions
-- Idempotent — peut être exécuté plusieurs fois sans erreur
-- ============================================================

-- 1. Nouveau rôle homme_blanc_chauve
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'plebe', 'homme_blanc_chauve'));

-- 2. Colonne is_free_bet dans daily_plays
ALTER TABLE public.daily_plays ADD COLUMN IF NOT EXISTS is_free_bet BOOLEAN NOT NULL DEFAULT false;

-- 3. Contrainte unique par type de spin (paid vs free)
ALTER TABLE public.daily_plays DROP CONSTRAINT IF EXISTS daily_plays_user_id_played_date_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_paid_daily ON public.daily_plays(user_id, played_date) WHERE is_free_bet = false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dp_free_daily ON public.daily_plays(user_id, played_date) WHERE is_free_bet = true;

-- 4. Nouveaux types de transactions
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('bet_win','bet_loss','daily_win','daily_loss','daily_free_win','admin_credit','admin_debit','signup_bonus','hbc_upgrade'));

-- 5. RLS transactions : chacun voit les siennes, super_admin voit tout
DROP POLICY IF EXISTS "tx_select"     ON public.transactions;
DROP POLICY IF EXISTS "tx_select_own" ON public.transactions;
CREATE POLICY "tx_select_own" ON public.transactions FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 6. RLS transactions INSERT : super_admin peut insérer pour n'importe qui
DROP POLICY IF EXISTS "tx_insert" ON public.transactions;
CREATE POLICY "tx_insert" ON public.transactions FOR INSERT WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- 7. RLS profiles UPDATE : super_admin peut modifier n'importe qui
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"     ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
