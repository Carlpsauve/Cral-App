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
      // Main 2 bust — fin du jeu. On doit vérifier le statut de la Main 1.
      const hand1Busted = session.hand1_result === 'bust'
      let dealerFull = session.dealer_hand as any[]
      let hand1Net = session.hand1_net as number ?? 0
      let hand1FinalResult = session.hand1_result

      if (!hand1Busted) {
        // La Main 1 s'était posée (standing) ! Le croupier DOIT jouer.
        const dp = dealerPlay(session.dealer_hand, deck)
        dealerFull = dp.hand
        const r1 = evaluateResult(session.player_hand, dealerFull)
        const p1 = Math.round(session.bet * resultMultiplier(r1) * 100) / 100
        hand1Net = Math.round((p1 - session.bet) * 100) / 100
        hand1FinalResult = r1

        if (hand1Net !== 0) {
          await supabase.from('transactions').insert({
            user_id: user.id, amount: hand1Net, type: hand1Net > 0 ? 'blackjack_win' : 'blackjack_loss',
            description: `Blackjack split main 1 ${r1} — mise ₡${session.bet}`,
          })
        }
        // Payer la Main 1
        const { data: p } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
        await supabase.from('profiles').update({ balance: (p?.balance ?? 0) + p1 }).eq('id', user.id)
      }

      // Re-fetch la balance finale
      const { data: finalProfile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      const totalNet = hand1Net + (-session.bet)

      await supabase.from('blackjack_sessions').update({
        split_hand: hand2, deck, status: 'resolved', result: 'bust',
        net_gain: totalNet,
        hand1_result: hand1FinalResult,
        hand1_net: hand1Net
      }).eq('id', session_id)

      await supabase.from('transactions').insert({
        user_id: user.id, amount: -session.bet, type: 'blackjack_loss',
        description: `Blackjack split main 2 bust — mise ₡${session.bet}`,
      })

      return NextResponse.json({
        hand2, hand2_value: pv, active_hand: 2,
        bust_hand2: true, finished: true,
        dealer_full: dealerFull, dealer_value: handValue(dealerFull), // <-- LE CORRECTIF VISUEL EST ICI
        hand1_result: hand1FinalResult, hand1_net: hand1Net,
        hand2_result: 'bust', hand2_net: -session.bet,
        net_gain: totalNet, new_balance: finalProfile?.balance ?? 0,
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
