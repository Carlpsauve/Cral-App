import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Use SECURITY DEFINER function — bypasses RLS, handles validation + debit atomically
  const { data, error } = await supabase.rpc('upgrade_to_hbc', { p_user_id: user.id })

  if (error) {
    console.error('upgrade_to_hbc RPC error:', error)
    return NextResponse.json({
      error: `Erreur serveur: ${error.message}. Vérifiez que migration_v2.sql a été exécuté.`,
    }, { status: 500 })
  }

  // The function returns a JSONB with either { error } or { success, newBalance }
  if (data?.error) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, newBalance: data.newBalance })
}
