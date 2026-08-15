'use client'

import { usePathname } from 'next/navigation'
import { MobileNav } from '@/components/mobile-nav'
import { cn } from '@/lib/utils'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthRoute = pathname?.startsWith('/sign-in') || pathname?.startsWith('/sign-up')

  return (
    <>
      <main
        className={cn(
          'mx-auto min-h-screen w-full max-w-[760px] md:px-6',
          !isAuthRoute && 'pb-20',
        )}
      >
        {children}
      </main>
      {!isAuthRoute && <MobileNav />}
    </>
  )
}
