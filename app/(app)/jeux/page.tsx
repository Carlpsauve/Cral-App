export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getMontrealDateString } from '@/lib/slots'
import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'

export default async function JeuxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = getMontrealDateString()

  const { data: slotPlay } = await supabase
    .from('daily_plays').select('id').eq('user_id', user.id).eq('played_date', today).eq('is_free_bet', false).maybeSingle()
  const { data: freePlay } = await supabase
    .from('daily_plays').select('id').eq('user_id', user.id).eq('played_date', today).eq('is_free_bet', true).maybeSingle()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <Gamepad2 className="text-gold-400" size={28} />
          Jeux
        </h1>
        <p className="text-cral-sub text-sm mt-1">Misez vos Cral$ et tentez de les multiplier</p>
      </div>

      <div className="space-y-4">
        <Link href="/jeux/slots" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🎰</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span className="font-display text-lg font-bold text-cral-text">Machine à sous</span>
                {!freePlay && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-400 bg-green-400/10">
                    🎁 Free bet dispo
                  </span>
                )}
                {!slotPlay && freePlay && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-yellow-400 bg-yellow-400/10">
                    Spin payant dispo
                  </span>
                )}
                {slotPlay && freePlay && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium text-cral-muted bg-cral-surface">
                    Spins du jour utilisés
                  </span>
                )}
              </div>
              <div className="text-sm text-cral-sub">1 free bet gratuit/jour · 1 spin payant (HBC = illimité)</div>
              <div className="text-xs text-cral-muted mt-1">Jackpot 💎💎💎 = ×50 · Retour ≈ 75%</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        <Link href="/jeux/blackjack" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🃏</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Blackjack</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-400 bg-green-400/10">
                  Illimité
                </span>
              </div>
              <div className="text-sm text-cral-sub">Battez le dealer · Mise ₡1–₡50 · Parties illimitées</div>
              <div className="text-xs text-cral-muted mt-1">Blackjack = ×2.5 · Dealer tire jusqu&apos;à 17</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        <Link href="/jeux/sports" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🏟️</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Paris sportifs</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-400 bg-green-400/10">
                  Illimité
                </span>
              </div>
              <div className="text-sm text-cral-sub">NHL Hockey</div>
              <div className="text-xs text-cral-muted mt-1">Moneyline · Résolution automatique · Cotes en direct</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        <Link href="/jeux/bigcral" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🎡</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Big Cral</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-purple-300 bg-purple-400/10">
                  Joker ×50
                </span>
              </div>
              <div className="text-sm text-cral-sub">Roue Big 6 · Misez sur plusieurs cases · Joker & Flag = ×50</div>
              <div className="text-xs text-cral-muted mt-1">54 cases · ₡1 à ₡500 par tour</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
