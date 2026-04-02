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

  const deck = session.deck as any[]
  const playerHand = [...session.player_hand as any[], deck[0]]
  const remaining = deck.slice(1)
  const pv = handValue(playerHand)

  if (isBust(playerHand)) {
    // Bust — dealer doesn't play, player loses bet
    const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
    const { hand: dealerFull } = dealerPlay(session.dealer_hand, remaining)

    await supabase.from('blackjack_sessions').update({
      player_hand: playerHand, deck: remaining, status: 'resolved', result: 'bust', net_gain: -session.bet
    }).eq('id', session_id)

    await supabase.from('transactions').insert({
      user_id: user.id, amount: -session.bet,
      type: 'blackjack_loss',
      description: `Blackjack bust — mise ₡${session.bet}`,
    })

    return NextResponse.json({
      player_hand: playerHand, player_value: pv,
      dealer_full: dealerFull, dealer_value: handValue(dealerFull),
      result: 'bust', net_gain: -session.bet,
      new_balance: profile?.balance ?? 0,
      finished: true,
    })
  }

  await supabase.from('blackjack_sessions').update({ player_hand: playerHand, deck: remaining }).eq('id', session_id)

  return NextResponse.json({
    player_hand: playerHand, player_value: pv,
    can_double: false, can_split: false,
    finished: false,
  })
}
