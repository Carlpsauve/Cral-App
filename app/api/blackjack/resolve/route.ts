import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { dealerPlay, evaluateResult, resultMultiplier, handValue } from '@/lib/blackjack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { bet, player_hand, deck_state } = await request.json()

  if (typeof bet !== 'number' || bet < 1 || bet > 50) {
    return NextResponse.json({ error: 'Mise invalide (₡1–₡50)' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('balance').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  if (profile.balance < bet) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })

  const deck = deck_state as any[]
  const { hand: dealerFull } = dealerPlay(
    [deck[0], deck[1]],
    deck.slice(4)
  )

  const result = evaluateResult(player_hand, dealerFull)
  const multiplier = resultMultiplier(result)
  const rawGain = Math.round(bet * multiplier * 100) / 100
  const netGain = rawGain - bet
  const newBalance = Math.max(0, Math.round((profile.balance + netGain) * 100) / 100)

  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)

  const type = netGain > 0 ? 'blackjack_win' : netGain < 0 ? 'blackjack_loss' : null
  if (type) {
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: Math.round(netGain * 100) / 100,
      type,
      description: `Blackjack — ${result === 'blackjack' ? 'Blackjack! ' : ''}mise ₡${bet}`,
    })
  }

  return NextResponse.json({
    result,
    dealer_hand: dealerFull,
    dealer_value: handValue(dealerFull),
    net_gain: netGain,
    new_balance: newBalance,
  })
}
