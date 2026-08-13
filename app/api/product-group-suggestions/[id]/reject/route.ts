import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { rejectProductGroupSuggestion } from '@/lib/product-group-suggestions'
import {
  notFoundError,
  operationErrorResponse,
  toOperationError,
  unauthorizedError,
} from '@/lib/operation-error'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const { id } = await params
    const suggestionId = Number(id)
    if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
      return operationErrorResponse(notFoundError('SUGGESTION_NOT_FOUND', 'Suggestion not found'))
    }

    return await withUserTransaction(userId, async client => {
      const result = await rejectProductGroupSuggestion(client, suggestionId, userId)
      if (result.kind === 'not_found') {
        return operationErrorResponse(notFoundError('SUGGESTION_NOT_FOUND', 'Suggestion not found'))
      }

      if (result.kind === 'invalid') {
        return operationErrorResponse({
          code: 'SUGGESTION_STATE_CONFLICT',
          category: 'conflict',
          message: result.message,
          retryable: false,
        })
      }

      return Response.json(result.suggestion)
    })
  } catch (error) {
    console.error('Error rejecting product group suggestion:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'SUGGESTION_REJECT_FAILED',
      message: 'Failed to reject product group suggestion',
    }))
  }
}
