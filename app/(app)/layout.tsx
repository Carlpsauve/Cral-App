export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop only */}
      <div className="hidden md:block">
        <Sidebar profile={profile} />
      </div>

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden">
        <MobileNav profile={profile} />
      </div>
    </div>
  )
}
