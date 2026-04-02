export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { formatCral, formatDate, cn } from '@/lib/utils'
import { redirect } from 'next/navigation'
import { History } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  bet_win: '🎲 Gajure gagnée',
  bet_loss: '🎲 Gajure perdue',
  daily_win: '🎰 Daily — gain',
  daily_loss: '🎰 Daily — perte',
  admin_credit: '⚡ Crédit admin',
  admin_debit: '⚡ Débit admin',
  signup_bonus: '🎁 Bonus inscription',
}

export default async function HistoriquePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*, profile:profiles(id, username, avatar_color)')
    .order('created_at', { ascending: false })
    .limit(100)

  // Group by date
  const grouped: Record<string, any[]> = {}
  transactions?.forEach(tx => {
    const date = new Date(tx.created_at).toLocaleDateString('fr-CA', {
      timeZone: 'America/Montreal',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(tx)
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <History className="text-gold-400" size={28} />
          Historique
        </h1>
        <p className="text-cral-sub text-sm mt-1">Toutes les transactions de tous les joueurs</p>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="card text-center py-16 text-cral-sub">
          <div className="text-3xl mb-3">📋</div>
          <div className="text-sm">Aucune transaction pour l&apos;instant.</div>
        </div>
      )}

      {Object.entries(grouped).map(([date, txs]) => (
        <section key={date}>
          <div className="text-xs text-cral-muted uppercase tracking-widest mb-3 px-1 capitalize">{date}</div>
          <div className="card divide-y divide-cral-border">
            {txs.map(tx => (
              <div key={tx.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cral-text">{TYPE_LABELS[tx.type] ?? tx.type}</span>
                    {tx.profile && tx.user_id !== user.id && (
                      <span className="text-xs text-cral-muted">· {tx.profile.username}</span>
                    )}
                    {tx.user_id === user.id && (
                      <span className="text-xs text-gold-500/70">vous</span>
                    )}
                  </div>
                  <div className="text-xs text-cral-sub mt-0.5">{tx.description}</div>
                  <div className="text-xs text-cral-muted mt-0.5">{formatDate(tx.created_at)}</div>
                </div>
                <span className={cn(
                  'font-mono font-medium text-sm flex-shrink-0',
                  tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                )}>
                  {tx.amount >= 0 ? '+' : ''}₡{formatCral(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
