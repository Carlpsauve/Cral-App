export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/auth/login')

  const { data: stats } = await supabase
    .from('transactions').select('amount, type').eq('user_id', user.id)

  const { data: dailyCount } = await supabase
    .from('daily_plays').select('id', { count: 'exact' }).eq('user_id', user.id)

  const { data: betWins } = await supabase
    .from('bets').select('id', { count: 'exact' }).eq('winner_id', user.id)

  const { data: totalBets } = await supabase
    .from('bet_participants').select('id', { count: 'exact' })
    .eq('user_id', user.id).eq('accepted', true)

  const totalWon = stats?.filter(t => t.amount > 0 && t.type !== 'signup_bonus').reduce((s, t) => s + t.amount, 0) ?? 0
  const totalLost = Math.abs(stats?.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0) ?? 0)
  const netPnl = totalWon - totalLost

  return (
    <ProfileClient
      profile={profile}
      stats={{
        totalWon,
        totalLost,
        netPnl,
        dailyPlays: dailyCount?.length ?? 0,
        betWins: betWins?.length ?? 0,
        totalBets: totalBets?.length ?? 0,
      }}
    />
  )
}
