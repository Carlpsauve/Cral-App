import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { playSlots, getMontrealDateString } from '@/lib/slots'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { lines, bet_per_line } = await request.json()

  // Validate inputs
  if (!Number.isInteger(lines) || lines < 1 || lines > 5) {
    return NextResponse.json({ error: 'Nombre de lignes invalide (1-5)' }, { status: 400 })
  }
  if (typeof bet_per_line !== 'number' || bet_per_line < 0.5 || bet_per_line > 10) {
    return NextResponse.json({ error: 'Mise invalide (0.5–10)' }, { status: 400 })
  }

  const totalBet = lines * bet_per_line
  const today = getMontrealDateString()

  // Check already played today
  const { data: existing } = await supabase
    .from('daily_plays')
    .select('id')
    .eq('user_id', user.id)
    .eq('played_date', today)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Déjà joué aujourd\'hui' }, { status: 400 })
  }

  // Check balance
  const { data: profile } = await supabase
    .from('profiles')
    .select('balance')
    .eq('id', user.id)
    .single()

  if (!profile || profile.balance < totalBet) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
  }

  // Run the game server-side
  const result = playSlots(lines, bet_per_line)
  const netResult = result.totalWin - result.totalBet
  const newBalance = Math.max(0, profile.balance + netResult)

  // Save play
  await supabase.from('daily_plays').insert({
    user_id: user.id,
    played_date: today,
    lines_played: lines,
    bet_per_line,
    total_bet: result.totalBet,
    result: result.lines,
    total_win: result.totalWin,
  })

  // Update balance
  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)

  // Record transaction
  if (netResult !== 0) {
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: Math.round(netResult * 100) / 100,
      type: netResult > 0 ? 'daily_win' : 'daily_loss',
      description: `Daily machine à sous — ${lines} ligne${lines > 1 ? 's' : ''} à ₡${bet_per_line}/ligne`,
    })
  }

  return NextResponse.json({ result, newBalance })
}
