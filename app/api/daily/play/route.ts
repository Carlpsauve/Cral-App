import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { playSlots, getMontrealDateString } from '@/lib/slots'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { lines, bet_per_line, is_free_bet } = await request.json()
  const today = getMontrealDateString()

  const { data: profile } = await supabase
    .from('profiles')
    .select('balance, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })

  const isHBC = profile.role === 'homme_blanc_chauve' || profile.role === 'super_admin'

  // ── FREE BET ────────────────────────────────────────────────
  if (is_free_bet) {
    // Check free bet not already used today
    const { data: existingFree } = await supabase
      .from('daily_plays')
      .select('id')
      .eq('user_id', user.id)
      .eq('played_date', today)
      .eq('is_free_bet', true)
      .maybeSingle()

    if (existingFree) {
      return NextResponse.json({ error: 'Free bet déjà utilisé aujourd\'hui' }, { status: 400 })
    }

    // Free bet: always 1 line, ₡1 mise, no cost
    const FREE_BET_MISE = 1
    const result = playSlots(1, FREE_BET_MISE)
    const gain = result.totalWin
    const newBalance = Math.round((profile.balance + gain) * 100) / 100

    await supabase.from('daily_plays').insert({
      user_id: user.id,
      played_date: today,
      lines_played: 1,
      bet_per_line: FREE_BET_MISE,
      total_bet: 0, // free — no cost
      result: result.lines,
      total_win: gain,
      is_free_bet: true,
    })

    await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)

    if (gain > 0) {
      await supabase.from('transactions').insert({
        user_id: user.id,
        amount: gain,
        type: 'daily_free_win',
        description: `Free bet quotidien — gain ₡${gain.toFixed(2)}`,
      })
    }

    return NextResponse.json({ result, newBalance, is_free_bet: true })
  }

  // ── PAID SPIN ────────────────────────────────────────────────

  // Validate inputs
  if (!Number.isInteger(lines) || lines < 1 || lines > 5) {
    return NextResponse.json({ error: 'Nombre de lignes invalide (1-5)' }, { status: 400 })
  }
  if (typeof bet_per_line !== 'number' || bet_per_line < 0.5 || bet_per_line > 10) {
    return NextResponse.json({ error: 'Mise invalide (0.5–10)' }, { status: 400 })
  }

  const totalBet = lines * bet_per_line

  // HBC = unlimited paid spins per day; others = 1 paid spin per day
  if (!isHBC) {
    const { data: existingPaid } = await supabase
      .from('daily_plays')
      .select('id')
      .eq('user_id', user.id)
      .eq('played_date', today)
      .eq('is_free_bet', false)
      .maybeSingle()

    if (existingPaid) {
      return NextResponse.json({ error: 'Déjà joué aujourd\'hui (passez HBC pour jouer en illimité!)' }, { status: 400 })
    }
  }

  if (profile.balance < totalBet) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
  }

  const result = playSlots(lines, bet_per_line)
  const netResult = result.totalWin - result.totalBet
  const newBalance = Math.max(0, Math.round((profile.balance + netResult) * 100) / 100)

  await supabase.from('daily_plays').insert({
    user_id: user.id,
    played_date: today,
    lines_played: lines,
    bet_per_line,
    total_bet: result.totalBet,
    result: result.lines,
    total_win: result.totalWin,
    is_free_bet: false,
  })

  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)

  if (netResult !== 0) {
    await supabase.from('transactions').insert({
      user_id: user.id,
      amount: Math.round(netResult * 100) / 100,
      type: netResult > 0 ? 'daily_win' : 'daily_loss',
      description: `Daily machine à sous — ${lines} ligne${lines > 1 ? 's' : ''} à ₡${bet_per_line}/ligne${isHBC ? ' (HBC)' : ''}`,
    })
  }

  return NextResponse.json({ result, newBalance, is_free_bet: false })
}
