import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgAnalyticsRepository } from '@/lib/analytics-repository'
import { getDashboardStats } from '@/lib/analytics'
import { operationErrorResponse, toOperationError, unauthorizedError } from '@/lib/operation-error'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const stats = await withUserTransaction(userId, async client =>
      getDashboardStats(createPgAnalyticsRepository(client, userId))
    )

    return Response.json(stats)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'ANALYTICS_FETCH_FAILED',
      message: 'Failed to fetch analytics',
    }))
  }
}
