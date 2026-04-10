export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { getMontrealDateString } from '@/lib/slots'
import Link from 'next/link'
import { Gamepad2, Target, CheckCircle2, AlertCircle } from 'lucide-react'

export default async function JeuxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const today = getMontrealDateString()

  // Requêtes existantes
  const { data: slotPlay } = await supabase.from('daily_plays').select('id').eq('user_id', user.id).eq('played_date', today).eq('is_free_bet', false).maybeSingle()
  const { data: freePlay } = await supabase.from('daily_plays').select('id').eq('user_id', user.id).eq('played_date', today).eq('is_free_bet', true).maybeSingle()

  // NOUVEAU : Récupérer les quêtes globales ET la progression du joueur
  const { data: globalData } = await supabase.from('daily_global_quests').select('quests').eq('played_date', today).maybeSingle()
  const { data: bounty } = await supabase.from('daily_bounties').select('*').eq('user_id', user.id).eq('played_date', today).maybeSingle()
  
  const activeQuests: any[] = globalData?.quests || [];
  const isCompleted = bounty?.is_completed || false;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <Gamepad2 className="text-gold-400" size={28} />
          Jeux
        </h1>
        <p className="text-cral-sub text-sm mt-1">Misez vos Cral$ et tentez de les multiplier</p>
      </div>

      {/* BANNIÈRE DES QUÊTES DYNAMIQUES */}
      <div className={`p-6 rounded-2xl border shadow-xl relative overflow-hidden ${isCompleted ? 'bg-green-900/20 border-green-500/50' : 'bg-gray-900/50 border-gray-800'}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Target className={isCompleted ? "text-green-400" : "text-gold-400"} /> 
            Missions du Jour
          </h2>
          <div className="text-sm font-bold bg-black/40 px-3 py-1 rounded-full text-gold-400 border border-gold-900/30">
            Récompense : 30 ₡
          </div>
        </div>

        {activeQuests.length === 0 ? (
          <div className="flex items-center gap-3 text-gray-400 bg-black/20 p-4 rounded-xl border border-gray-800/50">
            <AlertCircle size={20} />
            <p>Les quêtes du jour ne sont pas encore générées. Le tirage a lieu à minuit !</p>
          </div>
        ) : isCompleted ? (
          <div className="flex flex-col items-center justify-center py-4 text-green-400 animate-in fade-in zoom-in">
            <CheckCircle2 size={48} className="mb-2" />
            <p className="font-bold text-lg">Missions accomplies !</p>
            <p className="text-sm text-green-500/80">30 ₡ ont été ajoutés à ton solde.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeQuests.map((q, index) => {
              // On lit la progression dans la base de données selon l'ID de la quête
              const progressRaw = bounty?.[q.id] || 0;
              const progress = Math.min(progressRaw, q.target); // Bloquer au maximum (ex: 3/3)
              const percent = (progress / q.target) * 100;
              
              return (
                <div key={index} className="bg-black/30 p-4 rounded-xl border border-gray-800/50 flex flex-col h-full">
                  <div className="text-sm font-bold text-gray-300 mb-1">{q.title}</div>
                  <div className="text-xs text-gray-500 mb-3 flex-1">{q.desc}</div>
                  <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-gold-500 h-full transition-all duration-500" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="text-right text-xs font-mono font-bold mt-1 text-gold-400">{progress} / {q.target}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Machine à sous */}
        <Link href="/jeux/slots" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🎰</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <span className="font-display text-lg font-bold text-cral-text">Machine à sous</span>
                {!freePlay && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-400 bg-green-400/10">🎁 Free bet dispo</span>}
                {!slotPlay && freePlay && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-yellow-400 bg-yellow-400/10">Spin payant dispo</span>}
                {slotPlay && freePlay && <span className="text-xs px-2 py-0.5 rounded-full font-medium text-cral-muted bg-cral-surface">Spins du jour utilisés</span>}
              </div>
              <div className="text-sm text-cral-sub">1 free bet gratuit/jour · 1 spin payant (HBC = illimité)</div>
              <div className="text-xs text-cral-muted mt-1">Jackpot 💎💎💎 = ×50 · Retour ≈ 75%</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        {/* Blackjack */}
        <Link href="/jeux/blackjack" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🃏</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Blackjack</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-400 bg-green-400/10">Illimité</span>
              </div>
              <div className="text-sm text-cral-sub">Battez le dealer · Mise ₡1–₡50 · Parties illimitées</div>
              <div className="text-xs text-cral-muted mt-1">Blackjack = ×2.5 · Dealer tire jusqu&apos;à 17</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        {/* Paris sportifs */}
        <Link href="/jeux/sports" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🏟️</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Paris sportifs</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-green-400 bg-green-400/10">Illimité</span>
              </div>
              <div className="text-sm text-cral-sub">NHL Hockey</div>
              <div className="text-xs text-cral-muted mt-1">Moneyline · Résolution automatique · Cotes en direct</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        {/* Big Cral */}
        <Link href="/jeux/bigcral" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🎡</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Big Cral</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-purple-300 bg-purple-400/10">Joker ×50</span>
              </div>
              <div className="text-sm text-cral-sub">Roue Big 6 · Misez sur plusieurs cases · Joker & Flag = ×50</div>
              <div className="text-xs text-cral-muted mt-1">54 cases · ₡1 à ₡500 par tour</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        {/* Sugar Cral */}
        <Link href="/sugar-cral" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🍬</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Sugar Cral</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-blue-400 bg-blue-400/10">Idle Game</span>
              </div>
              <div className="text-sm text-cral-sub">Accomplissez des corvées pour Sugar Cral en échange d&apos;argent.</div>
              <div className="text-xs text-cral-muted mt-1">Tâches en arrière-plan · +2₡ à +30₡ par mission</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>

        {/* Quiz Mort Subite */}
        <Link href="/jeux/quiz" className="card hover:border-gold-500/30 transition-all duration-200 group block">
          <div className="flex items-center gap-5">
            <div className="text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">🧠</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <span className="font-display text-lg font-bold text-cral-text">Quiz Mort Subite</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium text-amber-400 bg-amber-400/10">Daily Challenge</span>
              </div>
              <div className="text-sm text-cral-sub">Répondez Vrai ou Faux aux questions générées par l&apos;IA. 1 erreur = Éliminé.</div>
              <div className="text-xs text-cral-muted mt-1">Le 1er du classement remporte 50 ₡ à minuit !</div>
            </div>
            <div className="text-cral-muted group-hover:text-gold-400 transition-colors">→</div>
          </div>
        </Link>
      </div>
    </div>
  )
}