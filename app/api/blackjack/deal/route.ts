import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createDeck, handValue, isBlackjack, dealerPlay, evaluateResult, resultMultiplier } from '@/lib/blackjack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { bet } = await request.json()
  if (typeof bet !== 'number' || bet < 1 || bet > 500) {
    return NextResponse.json({ error: 'Mise invalide (₡1–₡500)' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  if (!profile || profile.balance < bet) return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })

  // Delete any old unresolved session
  await supabase.from('blackjack_sessions').delete().eq('user_id', user.id).eq('status', 'playing')

  // Deal
  const deck = createDeck()
  const playerHand = [deck[0], deck[2]]
  const dealerHand = [deck[1], deck[3]]
  const remaining = deck.slice(4)

  // Reserve the bet immediately
  await supabase.from('profiles').update({ balance: profile.balance - bet }).eq('id', user.id)

  // Check natural blackjack
  if (isBlackjack(playerHand)) {
    const { hand: dealerFull } = dealerPlay(dealerHand, remaining)
    const result = evaluateResult(playerHand, dealerFull)
    const netGain = Math.round((bet * resultMultiplier(result) - bet) * 100) / 100
    const newBalance = Math.max(0, Math.round((profile.balance - bet + bet * resultMultiplier(result)) * 100) / 100)

    await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
    if (netGain !== 0) {
      await supabase.from('transactions').insert({
        user_id: user.id, amount: netGain,
        type: netGain > 0 ? 'blackjack_win' : 'blackjack_loss',
        description: `Blackjack naturel! mise ₡${bet}`,
      })
    }

    return NextResponse.json({
      session_id: null,
      player_hand: playerHand,
      dealer_visible: dealerHand[0],
      dealer_full: dealerFull,
      player_value: handValue(playerHand),
      dealer_value: handValue(dealerFull),
      result,
      net_gain: netGain,
      new_balance: newBalance,
      can_double: false,
      can_split: false,
      finished: true,
    })
  }

  // Save session
  const { data: session } = await supabase.from('blackjack_sessions').insert({
    user_id: user.id,
    bet,
    deck: remaining,
    player_hand: playerHand,
    dealer_hand: dealerHand,
    status: 'playing',
  }).select().single()

  const canDouble = profile.balance - bet >= bet // has enough for double
  const canSplit = playerHand[0].rank === playerHand[1].rank && profile.balance - bet >= bet

  return NextResponse.json({
    session_id: session?.id,
    player_hand: playerHand,
    dealer_visible: dealerHand[0], // only first card
    player_value: handValue(playerHand),
    can_double: canDouble,
    can_split: canSplit,
    finished: false,
  })
}
