import { auth } from '@/lib/auth'

export async function getSessionUserId(request: Request): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  return session?.user?.id ?? null
}
