import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { bet_id, winner_id, winning_team } = await request.json()
  if (!bet_id) return NextResponse.json({ error: 'bet_id manquant' }, { status: 400 })
  if (!winner_id && !winning_team) return NextResponse.json({ error: 'winner_id ou winning_team requis' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const { data: participation } = await supabase
    .from('bet_participants').select('id')
    .eq('bet_id', bet_id).eq('user_id', user.id).maybeSingle()

  const isSuperAdmin = profile?.role === 'super_admin'
  const isParticipant = !!participation

  if (!isSuperAdmin && !isParticipant) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { data: bet } = await supabase
    .from('bets').select('status, is_team_bet').eq('id', bet_id).single()
  if (!bet) return NextResponse.json({ error: 'Gajure introuvable' }, { status: 404 })
  if (bet.status === 'resolved' || bet.status === 'cancelled') {
    return NextResponse.json({ error: 'Gajure déjà terminée' }, { status: 400 })
  }

  const { data: participants } = await supabase
    .from('bet_participants').select('user_id, team')
    .eq('bet_id', bet_id).eq('accepted', true)
  const totalParticipants = participants?.length ?? 0
  const majority = Math.floor(totalParticipants / 2) + 1

  // ── TEAM BET ────────────────────────────────────────────────
  if (bet.is_team_bet && winning_team) {
    if (!isSuperAdmin) {
      // Check majority voted for this team
      const { data: votes } = await supabase
        .from('bet_votes').select('voted_for_id').eq('bet_id', bet_id)
      const votesForTeam = votes?.filter(v => v.voted_for_id === winning_team).length ?? 0
      if (votesForTeam < majority) {
        return NextResponse.json({ error: 'Majorité non atteinte' }, { status: 400 })
      }
    }

    const { error } = await supabase.rpc('resolve_bet_team', {
      p_bet_id: bet_id,
      p_winning_team: winning_team,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // ── SOLO BET ────────────────────────────────────────────────
  if (!isSuperAdmin) {
    const { data: votes } = await supabase
      .from('bet_votes').select('voted_for_id').eq('bet_id', bet_id)
    const votesForWinner = votes?.filter(v => v.voted_for_id === winner_id).length ?? 0
    if (votesForWinner < majority) {
      return NextResponse.json({ error: 'Majorité non atteinte' }, { status: 400 })
    }
  }

  const { error } = await supabase.rpc('resolve_bet', {
    p_bet_id: bet_id,
    p_winner_id: winner_id,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
