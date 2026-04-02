export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import AdminPanel from './AdminPanel'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profile || profile.role !== 'super_admin') redirect('/dashboard')

  const { data: players } = await supabase
    .from('profiles')
    .select('*')
    .order('username')

  return <AdminPanel players={players ?? []} currentUserId={user.id} />
}
