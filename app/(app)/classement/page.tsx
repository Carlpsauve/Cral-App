import { createClient } from '@/lib/supabase-server'
import { formatCral, getInitials } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { redirect } from 'next/navigation'
import { Trophy, TrendingUp } from 'lucide-react'

export const revalidate = 30

export default async function ClassementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: players } = await supabase
    .from('profiles')
    .select('id, username, balance, avatar_color, avatar_svg, role')
    .order('balance', { ascending: false })

  const { data: dailyWins } = await supabase
    .from('daily_plays')
    .select('user_id, total_win')

  const winsByUser: Record<string, number> = {}
  dailyWins?.forEach(d => {
    winsByUser[d.user_id] = (winsByUser[d.user_id] ?? 0) + d.total_win
  })

  const { data: betWins } = await supabase
    .from('transactions')
    .select('user_id, amount')
    .eq('type', 'bet_win')

  const betWinsByUser: Record<string, number> = {}
  betWins?.forEach(t => {
    betWinsByUser[t.user_id] = (betWinsByUser[t.user_id] ?? 0) + t.amount
  })

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-cral-text flex items-center gap-3">
          <Trophy className="text-gold-400" size={28} />
          Classement
        </h1>
        <p className="text-cral-sub text-sm mt-1">Qui domine les soirées?</p>
      </div>

      {/* Podium */}
      {players && players.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[players[1], players[0], players[2]].map((p, visualIdx) => {
            const rank = visualIdx === 0 ? 1 : visualIdx === 1 ? 0 : 2
            const isFirst = rank === 0
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-4 text-center transition-all ${
                  isFirst ? 'glow-gold' : ''
                }`}
                style={{
                  background: isFirst
                    ? 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))'
                    : '#1a1a26',
                  border: isFirst ? '1px solid rgba(251,191,36,0.4)' : '1px solid #2a2a40',
                  marginTop: isFirst ? 0 : '1rem',
                }}
              >
                <div className="text-2xl mb-2">{medals[rank]}</div>
                <Avatar username={p.username} avatarColor={p.avatar_color} avatarSvg={p.avatar_svg} size={48} className="mx-auto mb-2" />
                <div className="text-sm font-medium text-cral-text truncate">{p.username}</div>
                <div className={`font-mono font-bold mt-1 ${isFirst ? 'text-gold-400 text-lg' : 'text-cral-sub text-sm'}`}>
                  ₡{formatCral(p.balance)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full ranking */}
      <div className="card">
        <div className="space-y-1">
          {players?.map((p, idx) => {
            const isMe = p.id === user.id
            const totalBetWin = betWinsByUser[p.id] ?? 0
            const totalDailyWin = winsByUser[p.id] ?? 0
            return (
              <div
                key={p.id}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-150 ${
                  isMe ? 'bg-gold-400/10 border border-gold-400/20' : 'hover:bg-cral-surface'
                }`}
              >
                <div className={`w-8 text-center font-mono font-bold text-sm flex-shrink-0 ${
                  idx === 0 ? 'text-gold-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-cral-muted'
                }`}>
                  {idx < 3 ? medals[idx] : `#${idx + 1}`}
                </div>

                <Avatar username={p.username} avatarColor={p.avatar_color} avatarSvg={p.avatar_svg} size={36} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cral-text truncate">{p.username}</span>
                    {isMe && <span className="text-xs text-gold-500">vous</span>}
                    {p.role === 'super_admin' && <span className="text-xs text-purple-400">admin</span>}
                    {p.role === 'homme_blanc_chauve' && <span className="text-xs text-purple-300">🦲</span>}
                  </div>
                  <div className="text-xs text-cral-sub flex items-center gap-3 mt-0.5">
                    <span>🎲 ₡{formatCral(totalBetWin)}</span>
                    <span>🎰 ₡{formatCral(totalDailyWin)}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-bold text-sm text-cral-text">₡{formatCral(p.balance)}</div>
                  <div className={`text-xs flex items-center gap-1 justify-end ${
                    p.balance >= 100 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    <TrendingUp size={10} />
                    {p.balance >= 100 ? '+' : ''}{formatCral(p.balance - 100)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
