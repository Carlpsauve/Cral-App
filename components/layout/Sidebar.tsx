'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { cn, formatCral } from '@/lib/utils'
import Avatar from '@/components/ui/Avatar'
import { Profile } from '@/types'
import { LayoutDashboard, Swords, Gamepad2, Trophy, LogOut, Shield, History, User, Palette, Store, BookOpen, Coffee } from 'lucide-react'

// ✨ IMPORT DES CONFIGURATIONS DE TITRES ✨
import { TITLES_CONFIG } from '@/config/titles'

// On s'assure que le profil puisse recevoir `active_title`
interface SidebarProps { profile: Profile & { active_title?: string } }

export default function Sidebar({ profile: initialProfile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState(initialProfile)
  const [pendingBets, setPendingBets] = useState(0)
  const [hasPlayedToday, setHasPlayedToday] = useState(false)

  // ✨ Détermination du design selon le titre actif (ou le rôle par défaut)
  const activeTitleKey = profile.active_title || (TITLES_CONFIG[profile.role] ? profile.role : null)
  const activeConfig = activeTitleKey ? TITLES_CONFIG[activeTitleKey] : null

  useEffect(() => {
    async function loadBadges() {
      // Pending invitations
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

    // Keep profile in sync (balance AND active_title)
    const channel = supabase
      .channel(`sidebar-profile-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}`
      }, payload => {
        // ✨ On met à jour tout le profil pour capter les changements de titre en temps réel
        setProfile(prev => ({ ...prev, ...payload.new })) 
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
    { href: '/shop/boosters', label: 'Boutique', icon: Store },
    { href: '/shop/collection', label: 'Collection', icon: BookOpen },
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

      {/* ✨ User card Dynamique ✨ */}
      <Link href="/profil" className="p-4 border-b border-cral-border hover:bg-cral-card transition-colors group">
        <div className="flex items-center gap-3">
          
          {/* L'avatar avec le ring correspondant au titre */}
          <div className={activeConfig ? activeConfig.sidebarRing : ''}>
            <div className={activeConfig ? 'bg-[#12121a] rounded-full p-[2px]' : ''}>
              <Avatar username={profile.username} avatarColor={profile.avatar_color} avatarSvg={profile.avatar_svg} size={36} className="transition-transform group-hover:scale-105" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {/* Le texte du pseudo avec la couleur du titre */}
            <div className={`text-sm font-medium truncate ${activeConfig ? activeConfig.textClass : 'text-cral-text'}`}>
              {profile.username}
            </div>
            <div className="text-xs font-mono text-gold-400">₡{formatCral(profile.balance)}</div>
          </div>
          
          {/* La petite icône d'admin reste en priorité */}
          {profile.role === 'super_admin' && (
            <span className="text-xs flex-shrink-0">⚡</span>
          )}
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col overflow-y-auto">
        <div className="space-y-0.5">
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
        </div>

        {/* ✨ BOUTON MULTICOULEUR FLOTTANT EN BAS DU MENU ✨ */}
        <div className="mt-auto pt-6 pb-2 px-1">
          <a
            href="https://ko-fi.com/cralou"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-purple-500/40"
          >
            <Coffee size={18} className="group-hover:rotate-12 transition-transform" />
            <span>Soutenir Cral</span>
          </a>
        </div>
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