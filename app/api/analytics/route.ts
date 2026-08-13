import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgAnalyticsRepository } from '@/lib/analytics-repository'
import { getDashboardStats } from '@/lib/analytics'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stats = await withUserTransaction(userId, async client =>
      getDashboardStats(createPgAnalyticsRepository(client, userId))
    )

    return Response.json(stats)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
