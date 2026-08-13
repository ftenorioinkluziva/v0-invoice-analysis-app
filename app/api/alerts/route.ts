import { UpdateAlertSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgAlertRepository } from '@/lib/alert-repository'
import { listAlerts, markAlertRead } from '@/lib/alerts'
import { operationErrorResponse, toOperationError, unauthorizedError, validationError } from '@/lib/operation-error'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const alerts = await withUserTransaction(userId, async (client) =>
      listAlerts(createPgAlertRepository(client, userId))
    )
    return Response.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'ALERT_LIST_FAILED',
      message: 'Failed to fetch alerts',
    }))
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const parsed = UpdateAlertSchema.safeParse(await request.json())
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_ALERT_REQUEST',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
    }
    const { id, read } = parsed.data

    await withUserTransaction(userId, async (client) =>
      markAlertRead(createPgAlertRepository(client, userId), { id, read })
    )
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating alert:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'ALERT_UPDATE_FAILED',
      message: 'Failed to update alert',
    }))
  }
}
