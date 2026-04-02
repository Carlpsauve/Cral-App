import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { handValue, isBust, dealerPlay, evaluateResult, resultMultiplier } from '@/lib/blackjack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { session_id } = await request.json()
  const { data: session } = await supabase.from('blackjack_sessions')
    .select('*').eq('id', session_id).eq('user_id', user.id).eq('status', 'playing').single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  if (!profile || profile.balance < session.bet) {
    return NextResponse.json({ error: 'Solde insuffisant pour doubler' }, { status: 400 })
  }

  // Deduct extra bet immediately
  await supabase.from('profiles').update({ balance: profile.balance - session.bet }).eq('id', user.id)

  const deck = session.deck as any[]
  const playerHand = [...session.player_hand as any[], deck[0]]
  const remaining = deck.slice(1)
  const totalBet = session.bet * 2

  const { hand: dealerFull } = dealerPlay(session.dealer_hand, remaining)
  const result = isBust(playerHand) ? 'bust' : evaluateResult(playerHand, dealerFull)
  const payout = result === 'bust' ? 0 : Math.round(totalBet * resultMultiplier(result) * 100) / 100
  const netGain = Math.round((payout - totalBet) * 100) / 100
  const newBalance = Math.max(0, Math.round(((profile.balance - session.bet) + payout) * 100) / 100)

  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
  await supabase.from('blackjack_sessions').update({
    player_hand: playerHand, deck: remaining,
    bet: totalBet, status: 'resolved', result, net_gain: netGain,
  }).eq('id', session_id)

  if (netGain !== 0) {
    await supabase.from('transactions').insert({
      user_id: user.id, amount: netGain,
      type: netGain > 0 ? 'blackjack_win' : 'blackjack_loss',
      description: `Blackjack double down (×2) ${result} — mise ₡${totalBet}`,
    })
  }

  return NextResponse.json({
    player_hand: playerHand, player_value: handValue(playerHand),
    dealer_full: dealerFull, dealer_value: handValue(dealerFull),
    result, net_gain: netGain, new_balance: newBalance, finished: true,
  })
}
