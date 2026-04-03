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

  const deck = [...(session.deck as any[])]
  const card = deck.shift()!
  const isSplit = !!session.split_hand
  const activeHand = session.active_hand ?? 1

  if (isSplit && activeHand === 2) {
    // Hitting on hand 2
    const hand2 = [...(session.split_hand as any[]), card]
    const pv = handValue(hand2)

    if (isBust(hand2)) {
      // Hand 2 busts — game over (hand 1 already resolved)
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      const hand1Net = session.hand1_net as number ?? 0
      // hand2 loss already deducted at bet time, no refund
      await supabase.from('blackjack_sessions').update({
        split_hand: hand2, deck, status: 'resolved', result: 'bust',
        net_gain: hand1Net + (-session.bet),
      }).eq('id', session_id)
      await supabase.from('transactions').insert({
        user_id: user.id, amount: -session.bet, type: 'blackjack_loss',
        description: `Blackjack split main 2 bust — mise ₡${session.bet}`,
      })
      return NextResponse.json({
        hand2, hand2_value: pv, active_hand: 2,
        bust_hand2: true, finished: true,
        net_gain: hand1Net + (-session.bet),
        new_balance: profile?.balance ?? 0,
      })
    }

    await supabase.from('blackjack_sessions').update({ split_hand: hand2, deck }).eq('id', session_id)
    return NextResponse.json({ hand2, hand2_value: pv, active_hand: 2, finished: false })

  } else {
    // Hitting on hand 1 (or non-split)
    const hand1 = [...(session.player_hand as any[]), card]
    const pv = handValue(hand1)

    if (isBust(hand1)) {
      const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()

      if (isSplit) {
        // Hand 1 busts in split — move to hand 2
        await supabase.from('blackjack_sessions').update({
          player_hand: hand1, deck,
          active_hand: 2,
          hand1_result: 'bust',
          hand1_net: -session.bet,
        }).eq('id', session_id)
        await supabase.from('transactions').insert({
          user_id: user.id, amount: -session.bet, type: 'blackjack_loss',
          description: `Blackjack split main 1 bust — mise ₡${session.bet}`,
        })
        return NextResponse.json({
          hand1, hand1_value: pv,
          hand2: session.split_hand,
          hand2_value: handValue(session.split_hand as any[]),
          active_hand: 2,
          hand1_result: 'bust',
          finished: false, split_continue: true,
        })
      }

      // Non-split bust
      const { hand: dealerFull } = dealerPlay(session.dealer_hand, deck)
      await supabase.from('blackjack_sessions').update({
        player_hand: hand1, deck, status: 'resolved', result: 'bust', net_gain: -session.bet,
      }).eq('id', session_id)
      await supabase.from('transactions').insert({
        user_id: user.id, amount: -session.bet, type: 'blackjack_loss',
        description: `Blackjack bust — mise ₡${session.bet}`,
      })
      return NextResponse.json({
        hand1, hand1_value: pv,
        dealer_full: dealerFull, dealer_value: handValue(dealerFull),
        result: 'bust', net_gain: -session.bet,
        new_balance: profile?.balance ?? 0,
        finished: true,
      })
    }

    await supabase.from('blackjack_sessions').update({ player_hand: hand1, deck }).eq('id', session_id)
    return NextResponse.json({ hand1, hand1_value: pv, active_hand: 1, finished: false })
  }
}
