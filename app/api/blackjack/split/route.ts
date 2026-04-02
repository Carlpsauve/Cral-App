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
    return NextResponse.json({ error: 'Split impossible — la paire doit être identique' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  if (!profile || profile.balance < session.bet) {
    return NextResponse.json({ error: 'Solde insuffisant pour splitter' }, { status: 400 })
  }

  await supabase.from('profiles').update({ balance: profile.balance - session.bet }).eq('id', user.id)

  const deck = session.deck as any[]
  // Deal one card to each split hand
  const hand1 = [playerHand[0], deck[0]]
  const hand2 = [playerHand[1], deck[1]]
  const remaining = deck.slice(2)

  // Store split state: hand1 active first, hand2 pending
  await supabase.from('blackjack_sessions').update({
    player_hand: hand1,
    deck: remaining,
    // Store hand2 and split bet in session (reuse dealer_hand slot concept via JSON)
    // We'll use a separate column workaround: store split_hand in dealer_hand temporarily
  }).eq('id', session_id)

  // For simplicity, store hand2 in a meta field
  await supabase.from('blackjack_sessions').update({
    player_hand: hand1,
    deck: remaining,
    // We repurpose result field temporarily to store split data as JSON string
    result: JSON.stringify({ split_hand: hand2, split_active: false }),
  }).eq('id', session_id)

  return NextResponse.json({
    hand1, hand2,
    hand1_value: handValue(hand1),
    hand2_value: handValue(hand2),
    active_hand: 1,
    can_double: false, can_split: false,
    finished: false,
    split: true,
  })
}
