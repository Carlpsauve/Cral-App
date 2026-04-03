'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { cn, formatCral, getInitials } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { Profile } from '@/types'
import { LayoutDashboard, Swords, Gamepad2, Trophy, LogOut, Shield, History, User, Palette, Store } from 'lucide-react'

interface SidebarProps { profile: Profile }

export default function Sidebar({ profile: initialProfile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [pendingBets, setPendingBets] = useState(0)
  const [hasPlayedToday, setHasPlayedToday] = useState(false)

  useEffect(() => {
    async function loadBadges() {
      // Pending invitations: two-step query (avoid unsupported join-filter syntax)
      const { data: unaccepted } = await supabase
        .from('bet_participants')
        .select('bet_id')
        .eq('user_id', profile.id)
        .eq('accepted', false)

      if (unaccepted && unaccepted.length > 0) {
        const ids = unaccepted.map((r: any) => r.bet_id)
        const { data: active } = await supabase
          .from('bets')
          .select('id')
          .in('id', ids)
          .in('status', ['active', 'voting'])
        setPendingBets(active?.length ?? 0)
      } else {
        setPendingBets(0)
      }

      // Check if played today
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Montreal', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date())
      const { data: play } = await supabase
        .from('daily_plays').select('id')
        .eq('user_id', profile.id).eq('played_date', today).single()
      setHasPlayedToday(!!play)
    }
    loadBadges()

    // Keep balance in sync
    const channel = supabase
      .channel(`sidebar-profile-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}`
      }, payload => {
        setProfile(prev => ({ ...prev, balance: payload.new.balance }))
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bet_participants', filter: `user_id=eq.${profile.id}`
      }, () => loadBadges())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile.id])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      href: '/gajures', label: 'Gajures', icon: Swords,
      badge: pendingBets > 0 ? pendingBets : null
    },
    {
      href: '/jeux', label: 'Jeux', icon: Gamepad2,
      dot: !hasPlayedToday
    },
    { href: '/shop/collection', label: 'Boutique', icon: Store },
    { href: '/classement', label: 'Classement', icon: Trophy },
    { href: '/historique', label: 'Historique', icon: History },
  { href: '/avatar', label: 'Mon avatar', icon: Palette },
  ]

  return (
    <aside className="w-64 h-screen flex flex-col fixed left-0 top-0 z-30"
      style={{ background: '#12121a', borderRight: '1px solid #2a2a40' }}>

      {/* Logo */}
      <div className="p-6 border-b border-cral-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="text-2xl">🎰</span>
          <span className="font-display text-xl font-bold text-shimmer">CRAL</span>
        </Link>
      </div>

      {/* User card */}
      <Link href="/profil" className="p-4 border-b border-cral-border hover:bg-cral-card transition-colors group">
        <div className="flex items-center gap-3">
          <Avatar username={profile.username} avatarColor={profile.avatar_color} avatarSvg={profile.avatar_svg} size={36} className="transition-transform group-hover:scale-105" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-cral-text truncate">{profile.username}</div>
            <div className="text-xs font-mono text-gold-400">₡{formatCral(profile.balance)}</div>
          </div>
          {(profile.role === 'super_admin' || profile.role === 'homme_blanc_chauve') && (
            <span className="text-xs flex-shrink-0">{profile.role === 'super_admin' ? '⚡' : '🦲'}</span>
          )}
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, badge, dot }: any) => (
          <Link
            key={href}
            href={href}
            className={cn('nav-link relative', pathname === href && 'active')}
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
            {badge && (
              <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-gold-500 text-cral-bg text-[10px] font-bold flex items-center justify-center px-1">
                {badge}
              </span>
            )}
            {dot && !badge && (
              <span className="ml-auto w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
          </Link>
        ))}

        {profile.role === 'super_admin' && (
          <>
            <div className="pt-4 pb-1 px-3">
              <div className="text-xs text-cral-muted uppercase tracking-wider">Admin</div>
            </div>
            <Link href="/admin" className={cn('nav-link', pathname.startsWith('/admin') && 'active')}>
              <Shield size={16} />
              Panel Admin
            </Link>
          </>
        )}
      </nav>

      {/* Profile + Logout */}
      <div className="p-3 border-t border-cral-border space-y-0.5">
        <Link href="/profil" className={cn('nav-link', pathname === '/profil' && 'active')}>
          <User size={16} />
          Mon profil
        </Link>
        <button
          onClick={handleLogout}
          className="nav-link w-full text-red-400 hover:text-red-300 hover:bg-red-400/10"
        >
          <LogOut size={16} />
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
