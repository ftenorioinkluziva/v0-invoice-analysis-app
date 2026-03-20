import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/sign-in', '/sign-up']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = getSessionCookie(request)

  if (sessionCookie && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!sessionCookie && !PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}
