import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { bet_id, force } = await request.json()
  if (!bet_id) return NextResponse.json({ error: 'bet_id manquant' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  const { data: bet } = await supabase
    .from('bets').select('creator_id, status').eq('id', bet_id).single()

  if (!bet) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (bet.status === 'resolved' || bet.status === 'cancelled') {
    return NextResponse.json({ error: 'Gajure déjà terminée' }, { status: 400 })
  }

  const isSuperAdmin = profile?.role === 'super_admin'
  const isCreator = bet.creator_id === user.id
  const isParticipant = !!(await supabase
    .from('bet_participants')
    .select('id').eq('bet_id', bet_id).eq('user_id', user.id).eq('accepted', true).single()).data

  // Force cancel by admin/creator (with refund)
  if (force) {
    if (!isSuperAdmin && !isCreator) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }
    const { error } = await supabase.rpc('cancel_bet_refund', { p_bet_id: bet_id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, refunded: true })
  }

  // Vote to cancel (participant)
  if (!isParticipant && !isSuperAdmin) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Check already voted to cancel
  const { data: existingVote } = await supabase
    .from('bet_cancel_votes')
    .select('id').eq('bet_id', bet_id).eq('voter_id', user.id).single()

  if (existingVote) {
    return NextResponse.json({ error: 'Vous avez déjà voté pour annuler' }, { status: 400 })
  }

  // Record cancel vote
  await supabase.from('bet_cancel_votes').insert({ bet_id, voter_id: user.id })

  // Check if majority reached
  const { data: participants } = await supabase
    .from('bet_participants').select('user_id').eq('bet_id', bet_id).eq('accepted', true)

  const { data: cancelVotes } = await supabase
    .from('bet_cancel_votes').select('id').eq('bet_id', bet_id)

  const total = participants?.length ?? 0
  const votes = cancelVotes?.length ?? 0
  const majority = Math.floor(total / 2) + 1

  if (votes >= majority) {
    const { error } = await supabase.rpc('cancel_bet_refund', { p_bet_id: bet_id })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, refunded: true, triggered: true })
  }

  return NextResponse.json({ success: true, refunded: false, votes, majority })
}
