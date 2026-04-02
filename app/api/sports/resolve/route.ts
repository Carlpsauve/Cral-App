import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Admin seulement' }, { status: 403 })

  const { match_id, winner, home_score, away_score } = await request.json()
  if (!match_id || !winner || !['home', 'away', 'draw'].includes(winner)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  await supabase.from('sport_matches').update({
    status: 'finished',
    winner,
    home_score: home_score ?? null,
    away_score: away_score ?? null,
  }).eq('id', match_id)

  const { data: count } = await supabase.rpc('resolve_sport_bets', { p_match_id: match_id })

  return NextResponse.json({ success: true, bets_resolved: count })
}
