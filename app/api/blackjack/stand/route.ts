import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { handValue, dealerPlay, evaluateResult, resultMultiplier } from '@/lib/blackjack'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { session_id } = await request.json()
  const { data: session } = await supabase.from('blackjack_sessions')
    .select('*').eq('id', session_id).eq('user_id', user.id).eq('status', 'playing').single()
  if (!session) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })

  const isSplit = !!session.split_hand
  const activeHand = session.active_hand ?? 1

  if (isSplit && activeHand === 1) {
    // Standing on hand 1 in split — move to hand 2
    const hand1Result = evaluateResult(session.player_hand, [{ rank: '2', suit: '♠' }]) // placeholder, resolved later
    // Just move to hand 2
    await supabase.from('blackjack_sessions').update({
      active_hand: 2,
      hand1_result: 'standing', // marker: hand 1 stood, waiting for hand 2
    }).eq('id', session_id)

    return NextResponse.json({
      hand2: session.split_hand,
      hand2_value: handValue(session.split_hand as any[]),
      active_hand: 2,
      finished: false,
      split_continue: true,
    })
  }

  // Final stand — dealer plays and resolves all hands
  const { hand: dealerFull } = dealerPlay(session.dealer_hand, session.deck)
  const dealerVal = handValue(dealerFull)
  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  let totalNet = 0

  if (isSplit) {
    // Resolve hand 1
    const hand1 = session.player_hand as any[]
    let hand1Net = session.hand1_net as number ?? null

    if (hand1Net === null) {
      // hand1 wasn't busted — evaluate now
      const r1 = evaluateResult(hand1, dealerFull)
      const p1 = Math.round(session.bet * resultMultiplier(r1) * 100) / 100
      hand1Net = Math.round((p1 - session.bet) * 100) / 100
      if (hand1Net !== 0) {
        await supabase.from('transactions').insert({
          user_id: user.id, amount: hand1Net, type: hand1Net > 0 ? 'blackjack_win' : 'blackjack_loss',
          description: `Blackjack split main 1 ${r1} — mise ₡${session.bet}`,
        })
      }
      // Pay out hand 1
      await supabase.from('profiles').update({
        balance: (profile?.balance ?? 0) + p1
      }).eq('id', user.id)
    }

    // Resolve hand 2
    const hand2 = session.split_hand as any[]
    const hand2Busted = session.result === 'bust' // set during hit if busted
    let hand2Net = 0
    let hand2Result = 'bust'

    if (!hand2Busted) {
      const r2 = evaluateResult(hand2, dealerFull)
      const p2 = Math.round(session.bet * resultMultiplier(r2) * 100) / 100
      hand2Net = Math.round((p2 - session.bet) * 100) / 100
      hand2Result = r2
      if (hand2Net !== 0) {
        await supabase.from('transactions').insert({
          user_id: user.id, amount: hand2Net, type: hand2Net > 0 ? 'blackjack_win' : 'blackjack_loss',
          description: `Blackjack split main 2 ${r2} — mise ₡${session.bet}`,
        })
      }
      // Re-fetch balance after hand1 payout
      const { data: p2Profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
      await supabase.from('profiles').update({ balance: (p2Profile?.balance ?? 0) + p2 }).eq('id', user.id)
    }

    totalNet = (hand1Net ?? 0) + hand2Net

    await supabase.from('blackjack_sessions').update({
      status: 'resolved', net_gain: totalNet,
    }).eq('id', session_id)

    const { data: finalProfile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()

    return NextResponse.json({
      dealer_full: dealerFull, dealer_value: dealerVal,
      hand1_result: session.hand1_result?.startsWith('bust') ? 'bust' : evaluateResult(session.player_hand, dealerFull),
      hand2_result: hand2Result,
      hand1_net: hand1Net, hand2_net: hand2Net,
      net_gain: totalNet, new_balance: finalProfile?.balance ?? 0,
      finished: true,
    })

  } else {
    // Normal stand
    const result = evaluateResult(session.player_hand, dealerFull)
    const payout = Math.round(session.bet * resultMultiplier(result) * 100) / 100
    const netGain = Math.round((payout - session.bet) * 100) / 100
    const newBalance = Math.max(0, Math.round(((profile?.balance ?? 0) + payout) * 100) / 100)

    await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
    await supabase.from('blackjack_sessions').update({ status: 'resolved', result, net_gain: netGain }).eq('id', session_id)

    if (netGain !== 0) {
      await supabase.from('transactions').insert({
        user_id: user.id, amount: netGain, type: netGain > 0 ? 'blackjack_win' : 'blackjack_loss',
        description: `Blackjack ${result} — mise ₡${session.bet}`,
      })
    }

    return NextResponse.json({
      dealer_full: dealerFull, dealer_value: dealerVal,
      player_value: handValue(session.player_hand),
      result, net_gain: netGain, new_balance: newBalance, finished: true,
    })
  }
}
