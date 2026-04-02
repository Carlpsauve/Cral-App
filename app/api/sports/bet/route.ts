import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { potentialWin } from '@/lib/sports'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { match_id, pick, amount } = await request.json()

  if (!match_id || !pick || !['home', 'away', 'draw'].includes(pick)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount < 1 || amount > 1000) {
    return NextResponse.json({ error: 'Mise invalide (₡1–₡1000)' }, { status: 400 })
  }

  // Get match
  const { data: match } = await supabase
    .from('sport_matches').select('*').eq('id', match_id).single()
  if (!match) return NextResponse.json({ error: 'Match introuvable' }, { status: 404 })
  if (match.status !== 'upcoming') return NextResponse.json({ error: 'Ce match n\'est plus disponible aux paris' }, { status: 400 })

  // Check match hasn't started
  if (new Date(match.commence_time) < new Date()) {
    return NextResponse.json({ error: 'Ce match a déjà commencé' }, { status: 400 })
  }

  // Check pick has odds
  const odds = pick === 'home' ? match.odds_home : pick === 'away' ? match.odds_away : match.odds_draw
  if (!odds) return NextResponse.json({ error: 'Cote non disponible pour ce choix' }, { status: 400 })

  // Check no existing bet on this match
  const { data: existing } = await supabase
    .from('sport_bets').select('id').eq('user_id', user.id).eq('match_id', match_id).maybeSingle()
  if (existing) return NextResponse.json({ error: 'Vous avez déjà un pari sur ce match' }, { status: 400 })

  // Check balance
  const { data: profile } = await supabase
    .from('profiles').select('balance').eq('id', user.id).single()
  if (!profile || profile.balance < amount) {
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })
  }

  const potential = potentialWin(amount, odds)
  const newBalance = Math.round((profile.balance - amount) * 100) / 100

  // Deduct bet amount
  await supabase.from('profiles').update({ balance: newBalance }).eq('id', user.id)

  // Create bet
  const { data: bet, error } = await supabase.from('sport_bets').insert({
    user_id: user.id,
    match_id,
    pick,
    amount,
    odds,
    potential_win: potential,
    status: 'pending',
  }).select().single()

  if (error) {
    // Refund on error
    await supabase.from('profiles').update({ balance: profile.balance }).eq('id', user.id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Record transaction
  await supabase.from('transactions').insert({
    user_id: user.id,
    amount: -amount,
    type: 'bet_pending',
    description: `Pari sportif: ${match.home_team} vs ${match.away_team} (${pick === 'home' ? match.home_team : pick === 'away' ? match.away_team : 'Nul'} @ ×${odds})`,
    reference_id: bet.id,
  })

  return NextResponse.json({ success: true, bet, new_balance: newBalance })
}
