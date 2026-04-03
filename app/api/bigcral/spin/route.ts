import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { randomInt } from 'crypto'

export const dynamic = 'force-dynamic'

// Big 6 wheel — 54 total segments
// 1  (green):         26 times → 48.1%
// 3  (purple):        13 times → 24.1%
// 6  (light blue):     7 times → 13.0%
// 12 (dark blue):      4 times →  7.4%
// 25 (yellow):         2 times →  3.7%
// 50 (pink):           1 time  →  1.85%
// Joker (dark purple): 1 time  →  1.85%

const BIG6_SEGMENTS = [
  { id: 'one',    label: '1',     multiplier: 1,  color: '#16a34a', textColor: '#ffffff', count: 26 },
  { id: 'three',  label: '3',     multiplier: 3,  color: '#7c3aed', textColor: '#ffffff', count: 13 },
  { id: 'six',    label: '6',     multiplier: 6,  color: '#0ea5e9', textColor: '#ffffff', count: 7  },
  { id: 'twelve', label: '12',    multiplier: 12, color: '#1d4ed8', textColor: '#ffffff', count: 4  },
  { id: 'tfive',  label: '25',    multiplier: 25, color: '#ca8a04', textColor: '#ffffff', count: 2  },
  { id: 'fifty',  label: '50',    multiplier: 50, color: '#db2777', textColor: '#ffffff', count: 1  },
  { id: 'joker',  label: 'JOKER', multiplier: 50, color: '#581c87', textColor: '#fbbf24', count: 1  },
]

// WHEEL_ORDER — 54 segments arranged so that 1s are evenly spread between
// all other values. Pattern: always place a '1' between every non-1 segment,
// then fill remaining slots with '1's distributed evenly.
//
// Non-1 segments: 3×13 + 6×7 + 12×4 + 25×2 + 50×1 + J×1 = 28 slots
// 1s available: 26 — so 26 of the 28 gaps between non-1s get a '1',
// the other 2 gaps have two non-1s adjacent (for 50 and Joker which are rare).
//
// Concrete layout (54 slots):
// Spread non-1s evenly, inserting a '1' after each wherever possible.
const WHEEL_ORDER = (() => {
  const one    = BIG6_SEGMENTS[0]
  const three  = BIG6_SEGMENTS[1]
  const six    = BIG6_SEGMENTS[2]
  const twelve = BIG6_SEGMENTS[3]
  const tfive  = BIG6_SEGMENTS[4]
  const fifty  = BIG6_SEGMENTS[5]
  const joker  = BIG6_SEGMENTS[6]

  // Hand-craft a balanced 54-slot wheel:
  // Pattern repeats a "block" of rare/mid values separated by 1s.
  // 26 ones spread across 54 positions between the 28 non-one segments.
  // Two non-one segments will share a gap (50 and Joker sit adjacent — they're unique).
  const wheel = [
    one, three, one, six,   one, three, one, twelve, one, three,
    one, six,   one, three, one, tfive, one, three,  one, six,
    one, three, one, twelve,one, three, one, six,    one, three,
    one, tfive, one, three, one, six,   one, three,  one, twelve,
    one, three, one, six,   one, three, one, twelve, one, three,
    fifty, joker, one, three,
  ]

  // Safety check — should always be 54
  if (wheel.length !== 54) {
    throw new Error(`WHEEL_ORDER has ${wheel.length} segments, expected 54`)
  }

  return wheel
})()

// FIX: spin picks a random INDEX in WHEEL_ORDER (not a random segment from WHEEL).
// This way the landed_index returned to the client matches exactly what was picked.
function spin(): number {
  return randomInt(WHEEL_ORDER.length) // Génère un nombre sécurisé entre 0 et 53
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

  // FIX: pick index first, then derive the segment — index and segment are now in sync
  const landedIndex = spin()
  const landed = WHEEL_ORDER[landedIndex]

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
