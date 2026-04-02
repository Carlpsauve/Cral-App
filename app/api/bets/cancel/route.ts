import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { bet_id } = await request.json()
  if (!bet_id) return NextResponse.json({ error: 'bet_id manquant' }, { status: 400 })

  const { data: bet } = await supabase.from('bets').select('creator_id, status').eq('id', bet_id).single()
  if (!bet) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (bet.status === 'resolved' || bet.status === 'cancelled') {
    return NextResponse.json({ error: 'Déjà terminée' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isSuperAdmin = profile?.role === 'super_admin'
  const isCreator = bet.creator_id === user.id

  if (!isSuperAdmin && !isCreator) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  await supabase.from('bets').update({ status: 'cancelled' }).eq('id', bet_id)
  return NextResponse.json({ success: true })
}
