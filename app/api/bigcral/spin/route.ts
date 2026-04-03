import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// Big 6 wheel — 54 total segments
// 1  (green):       26 times → 48.1%
// 3  (purple):      13 times → 24.1%
// 6  (light blue):   7 times → 13.0%
// 12 (dark blue):    4 times →  7.4%
// 25 (yellow):       2 times →  3.7%
// 50 (pink):         1 time  →  1.85%
// Joker (dark purple): 1 time → 1.85%

export const BIG6_SEGMENTS = [
  { id: 'one',   label: '1',     multiplier: 1,  color: '#16a34a', textColor: '#ffffff', count: 26 },
  { id: 'three', label: '3',     multiplier: 3,  color: '#7c3aed', textColor: '#ffffff', count: 13 },
  { id: 'six',   label: '6',     multiplier: 6,  color: '#0ea5e9', textColor: '#ffffff', count: 7  },
  { id: 'twelve',label: '12',    multiplier: 12, color: '#1d4ed8', textColor: '#ffffff', count: 4  },
  { id: 'tfive', label: '25',    multiplier: 25, color: '#ca8a04', textColor: '#ffffff', count: 2  },
  { id: 'fifty', label: '50',    multiplier: 50, color: '#db2777', textColor: '#ffffff', count: 1  },
  { id: 'joker', label: 'JOKER', multiplier: 45, color: '#581c87', textColor: '#fbbf24', count: 1  },
]

// Build wheel array — interleaved for visual balance
const WHEEL: typeof BIG6_SEGMENTS[0][] = []
for (const seg of BIG6_SEGMENTS) {
  for (let i = 0; i < seg.count; i++) WHEEL.push(seg)
}
// Shuffle for visual distribution
export const WHEEL_ORDER = (() => {
  // Interleave segments so same colors aren't all clumped together
  const bins: typeof BIG6_SEGMENTS[0][][] = BIG6_SEGMENTS.map(s => Array(s.count).fill(s))
  const result: typeof BIG6_SEGMENTS[0][] = []
  let i = 0
  while (result.length < 54) {
    const bin = bins[i % bins.length]
    if (bin.length > 0) result.push(bin.pop()!)
    i++
  }
  return result
})()

function spin() {
  return WHEEL[Math.floor(Math.random() * WHEEL.length)]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { bets } = await request.json()
  if (!bets || typeof bets !== 'object') return NextResponse.json({ error: 'Paris invalides' }, { status: 400 })

  const totalBet = Object.values(bets as Record<string, number>).reduce((s: number, v) => s + (Number(v) || 0), 0)
  if (totalBet <= 0) return NextResponse.json({ error: 'Placez au moins un pari' }, { status: 400 })
  if (totalBet > 500) return NextResponse.json({ error: 'Mise totale max ₡500' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  if (!profile || profile.balance < totalBet) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })

  const landed = spin()
  const landedIndex = WHEEL_ORDER.findIndex(s => s.id === landed.id)

  let totalPayout = 0
  let netGain = -totalBet

  for (const [segId, amount] of Object.entries(bets as Record<string, number>)) {
    if (!amount || amount <= 0) continue
    if (segId === landed.id) {
      const payout = amount * (landed.multiplier + 1) // return bet + winnings
      totalPayout += payout
      netGain += payout
    }
  }

  const newBalance = Math.max(0, Math.round((profile.balance - totalBet + totalPayout) * 100) / 100)
  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)

  if (netGain !== 0) {
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: Math.round(netGain * 100) / 100,
      type: netGain > 0 ? 'daily_win' : 'daily_loss',
      description: `Big Cral — ${landed.label} — Mise: ₡${totalBet}`,
    })
  }

  return NextResponse.json({
    landed: landed.id,
    landed_label: landed.label,
    landed_multiplier: landed.multiplier,
    landed_index: landedIndex,
    net_gain: Math.round(netGain * 100) / 100,
    new_balance: newBalance,
  })
}
