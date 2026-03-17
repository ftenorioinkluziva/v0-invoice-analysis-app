'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ShoppingCart, TrendingUp, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/lista', icon: ShoppingCart, label: 'Lista' },
  { href: '/historico', icon: TrendingUp, label: 'Precos' },
  { href: '/alertas', icon: Bell, label: 'Alertas' },
  { href: '/config', icon: Settings, label: 'Config' },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
