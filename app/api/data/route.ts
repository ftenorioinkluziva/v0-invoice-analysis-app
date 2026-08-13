import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { DeleteAllDataSchema } from '@/lib/validations'
import { createPgUserDataDeletionRepository } from '@/lib/data-deletion-repository'
import { deleteAllUserData } from '@/lib/data-deletion'
import { operationErrorResponse, toOperationError, unauthorizedError, validationError } from '@/lib/operation-error'

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return operationErrorResponse(validationError(
        'DATA_DELETION_CONFIRMATION_REQUIRED',
        'Confirmation required',
        ['confirmation']
      ))
    }

    const parsed = DeleteAllDataSchema.safeParse(payload)
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'DATA_DELETION_CONFIRMATION_REQUIRED',
          'Confirmation required',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
    }

    await withUserTransaction(userId, async client =>
      deleteAllUserData(
        createPgUserDataDeletionRepository(client, userId),
        parsed.data
      )
    )

    return Response.json({ success: true, message: 'User data deleted successfully' })
  } catch (error) {
    console.error('Error deleting all data:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'DATA_DELETION_FAILED',
      message: 'Failed to delete data',
    }))
  }
}
