export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { formatCral, formatDate, getStatusLabel, getStatusColor, cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Swords, Gamepad2 } from 'lucide-react'
import Link from 'next/link'
import DashboardWheelTrigger from './DashboardWheelTrigger'

// ✨ IMPORT DES TITRES ✨
import { TITLES_CONFIG } from '@/config/titles'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: recentTx } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: myParticipations } = await supabase
    .from('bet_participants')
    .select('bet_id')
    .eq('user_id', user.id)
  const myBetIds = myParticipations?.map(p => p.bet_id) ?? []

  const { data: activeBets } = await supabase
    .from('bets')
    .select(`*, creator:profiles!bets_creator_id_fkey(username), participants:bet_participants(user_id, accepted)`)
    .in('status', ['pending', 'active', 'voting'])
    .or(myBetIds.length > 0
      ? `creator_id.eq.${user.id},id.in.(${myBetIds.join(',')})`
      : `creator_id.eq.${user.id}`)
    .order('created_at', { ascending: false })
    .limit(3)

  const { data: stats } = await supabase
    .from('transactions')
    .select('amount, type')
    .eq('user_id', user.id)

  const totalWon = stats?.filter(t => t.amount > 0 && t.type !== 'signup_bonus').reduce((s, t) => s + t.amount, 0) ?? 0
  const totalLost = Math.abs(stats?.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0) ?? 0)

  // ✨ Détermination de la configuration du titre du joueur ✨
  const activeTitleKey = profile?.active_title || (profile?.role && TITLES_CONFIG[profile.role] ? profile.role : null)
  const activeConfig = activeTitleKey ? TITLES_CONFIG[activeTitleKey] : null

  return (
    <div className="space-y-8">
      {/* Header avec Titre Dynamique */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl font-bold text-cral-text">
            Bonjour, {profile?.username}! 👋
          </h1>
          {/* ✨ Affichage dynamique du badge ✨ */}
          {activeConfig && (
            <span className={activeConfig.tagClass}>
              {activeConfig.label}
            </span>
          )}
        </div>
        <p className="text-cral-sub text-sm mt-1">Voici l&apos;état de vos finances Cral</p>
      </div>

      {/* Balance card */}
      <div className="relative overflow-hidden rounded-2xl p-8 glow-gold"
        style={{ background: 'linear-gradient(135deg, #1a1a26 0%, #12121a 100%)', border: '1px solid rgba(251,191,36,0.3)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 opacity-5" style={{
          background: 'radial-gradient(circle, #fbbf24 0%, transparent 70%)'
        }} />
        <div className="relative z-10">
          <div className="text-cral-sub text-sm mb-2 uppercase tracking-widest">Solde actuel</div>
          <div className="font-display text-6xl font-bold text-shimmer mb-1">
            ₡{formatCral(profile?.balance ?? 0)}
          </div>
          <div className="text-cral-sub text-xs font-mono">Cral dollars</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-400/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-green-400" />
          </div>
          <div>
            <div className="text-xs text-cral-sub">Total gagné</div>
            <div className="font-mono font-medium text-green-400">₡{formatCral(totalWon)}</div>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-red-400/10 flex items-center justify-center flex-shrink-0">
            <TrendingDown size={18} className="text-red-400" />
          </div>
          <div>
            <div className="text-xs text-cral-sub">Total perdu</div>
            <div className="font-mono font-medium text-red-400">₡{formatCral(totalLost)}</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/gajures/new" className="card hover:border-gold-500/40 transition-all duration-200 group cursor-pointer">
          <div className="flex items-center gap-3">
            <Swords size={20} className="text-gold-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-sm font-medium text-cral-text">Nouvelle gajure</div>
              <div className="text-xs text-cral-sub">Défiez vos amis</div>
            </div>
          </div>
        </Link>
        <Link href="/daily" className="card hover:border-gold-500/40 transition-all duration-200 group cursor-pointer">
          <div className="flex items-center gap-3">
            <Gamepad2 size={20} className="text-gold-400 group-hover:scale-110 transition-transform" />
            <div>
              <div className="text-sm font-medium text-cral-text">Daily Game</div>
              <div className="text-xs text-cral-sub">Machine à sous du jour</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Active bets */}
      {activeBets && activeBets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-cral-text">Gajures actives</h2>
            <Link href="/gajures" className="text-xs text-gold-400 hover:text-gold-300 transition-colors">Voir tout →</Link>
          </div>
          <div className="space-y-3">
            {activeBets.map((bet: any) => (
              <Link key={bet.id} href={`/gajures/${bet.id}`}
                className="card flex items-center justify-between hover:border-gold-500/30 transition-all duration-200">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-cral-text truncate">{bet.title}</div>
                  <div className="text-xs text-cral-sub mt-0.5">
                    par {bet.creator?.username} · ₡{formatCral(bet.amount)}
                  </div>
                </div>
                <span className={cn('text-xs px-2 py-1 rounded-full font-medium ml-4 flex-shrink-0', getStatusColor(bet.status))}>
                  {getStatusLabel(bet.status)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      {recentTx && recentTx.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-cral-text">Transactions récentes</h2>
            <Link href="/historique" className="text-xs text-gold-400 hover:text-gold-300 transition-colors">Voir tout →</Link>
          </div>
          <div className="card divide-y divide-cral-border">
            {recentTx.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="text-sm text-cral-text truncate">{tx.description}</div>
                  <div className="text-xs text-cral-sub mt-0.5">{formatDate(tx.created_at)}</div>
                </div>
                <span className={cn('font-mono font-medium text-sm ml-4 flex-shrink-0',
                  tx.amount >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {tx.amount >= 0 ? '+' : ''}₡{formatCral(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <DashboardWheelTrigger />
    </div>
  )
}