import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { getMontrealDateString } from '@/lib/slots'

export const dynamic = 'force-dynamic'

// Prize configuration
const WHEEL_PRIZES = [
  { amount: 1,    probability: 0.0499, label: '₡1',   color: '#6b7280' },
  { amount: 2.5,  probability: 0.10,   label: '₡2.50', color: '#60a5fa' },
  { amount: 5,    probability: 0.60,   label: '₡5',   color: '#34d399' },
  { amount: 10,   probability: 0.20,   label: '₡10',  color: '#fbbf24' },
  { amount: 25,   probability: 0.05,   label: '₡25',  color: '#f97316' },
  { amount: 50,   probability: 0.0001, label: '₡50',  color: '#a78bfa' },
]

function spinWheel(): typeof WHEEL_PRIZES[0] {
  const rand = Math.random()
  let cumulative = 0
  for (const prize of WHEEL_PRIZES) {
    cumulative += prize.probability
    if (rand < cumulative) return prize
  }
  return WHEEL_PRIZES[0]
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const today = getMontrealDateString()

  // Check already spun today
  const { data: existing } = await supabase
    .from('daily_wheel').select('id, reward').eq('user_id', user.id).eq('played_date', today).maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'Roue déjà tournée aujourd\'hui', already_played: true, reward: existing.reward }, { status: 400 })
  }

  const prize = spinWheel()
  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  const newBalance = Math.round(((profile?.balance ?? 0) + prize.amount) * 100) / 100

  await supabase.from('daily_wheel').insert({ user_id: user.id, played_date: today, reward: prize.amount })
  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
  await supabase.from('transactions').insert({
    user_id: user.id, amount: prize.amount, type: 'daily_free_win',
    description: `Roue de fortune quotidienne — +₡${prize.amount}`,
  })

  return NextResponse.json({ reward: prize.amount, prize_index: WHEEL_PRIZES.indexOf(prize), new_balance: newBalance })
}
