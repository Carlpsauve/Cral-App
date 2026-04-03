import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { handValue } from '@/lib/blackjack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { session_id } = await request.json()
  const { data: session } = await supabase.from('blackjack_sessions')
    .select('*').eq('id', session_id).eq('user_id', user.id).eq('status', 'playing').single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const playerHand = session.player_hand as any[]
  if (playerHand.length !== 2 || playerHand[0].rank !== playerHand[1].rank) {
    return NextResponse.json({ error: 'Split impossible — paire identique requise' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  if (!profile || profile.balance < session.bet) {
    return NextResponse.json({ error: 'Solde insuffisant pour splitter' }, { status: 400 })
  }

  // Deduct second bet
  await supabase.from('profiles').update({ balance: profile.balance - session.bet }).eq('id', user.id)

  const deck = session.deck as any[]
  // Each split card gets one new card
  const hand1 = [playerHand[0], deck[0]]
  const hand2 = [playerHand[1], deck[1]]
  const remaining = deck.slice(2)

  // Store: player_hand = hand1 (active), split_hand = hand2, active_hand = 1
  await supabase.from('blackjack_sessions').update({
    player_hand: hand1,
    split_hand: hand2,
    active_hand: 1,
    deck: remaining,
    result: null, // clear any stale result
  }).eq('id', session_id)

  return NextResponse.json({
    hand1,
    hand2,
    hand1_value: handValue(hand1),
    hand2_value: handValue(hand2),
    active_hand: 1,
    finished: false,
    split: true,
  })
}
