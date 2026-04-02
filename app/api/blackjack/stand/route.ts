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

  const { hand: dealerFull } = dealerPlay(session.dealer_hand, session.deck)
  const result = evaluateResult(session.player_hand, dealerFull)
  const payout = Math.round(session.bet * resultMultiplier(result) * 100) / 100
  const netGain = Math.round((payout - session.bet) * 100) / 100

  const { data: profile } = await supabase.from('profiles').select('balance').eq('id', user.id).single()
  const newBalance = Math.max(0, Math.round(((profile?.balance ?? 0) + payout) * 100) / 100)

  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)
  await supabase.from('blackjack_sessions').update({ status: 'resolved', result, net_gain: netGain }).eq('id', session_id)

  if (netGain !== 0) {
    await supabase.from('transactions').insert({
      user_id: user.id, amount: netGain,
      type: netGain > 0 ? 'blackjack_win' : 'blackjack_loss',
      description: `Blackjack ${result} — mise ₡${session.bet}`,
    })
  }

  return NextResponse.json({
    dealer_full: dealerFull, dealer_value: handValue(dealerFull),
    player_value: handValue(session.player_hand),
    result, net_gain: netGain, new_balance: newBalance, finished: true,
  })
}
