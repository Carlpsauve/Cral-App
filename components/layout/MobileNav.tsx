'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Profile } from '@/types'
// 1. AJOUT DE 'Store' ICI 👇
import { LayoutDashboard, Swords, Gamepad2, Trophy, History, Store } from 'lucide-react'

interface MobileNavProps {
  profile: Profile
  pendingBets?: number
  hasPlayedToday?: boolean
}

// 2. AJOUT DU SHOP DANS LE TABLEAU 👇
const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/gajures', label: 'Gajures', icon: Swords },
  { href: '/jeux', label: 'Jeux', icon: Gamepad2 },
  { href: '/shop/boosters', label: 'Boutique', icon: Store }, 
  { href: '/classement', label: 'Top', icon: Trophy },
  { href: '/historique', label: 'Historique', icon: History },
]

export default function MobileNav({ profile, pendingBets = 0, hasPlayedToday = false }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden border-t border-cral-border"
      style={{ background: '#12121a' }}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        const showBadge = href === '/gajures' && pendingBets > 0
        const showDot = href === '/jeux' && !hasPlayedToday

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-1 py-3 relative transition-colors',
              isActive ? 'text-gold-400' : 'text-cral-muted'
            )}
          >
            <div className="relative">
              <Icon size={20} />
              {showBadge && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-gold-500 text-cral-bg text-[9px] font-bold flex items-center justify-center px-0.5">
                  {pendingBets}
                </span>
              )}
              {showDot && !showBadge && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400" />
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}