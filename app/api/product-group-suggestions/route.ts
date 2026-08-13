import { getSessionUserId } from '@/lib/auth-session'
import { isMissingRelationError } from '@/lib/db-errors'
import { withUserTransaction } from '@/lib/session-sql'
import {
  listPendingProductGroupSuggestions,
  recomputeProductGroupSuggestions,
} from '@/lib/product-group-suggestions'
import { operationErrorResponse, toOperationError, unauthorizedError } from '@/lib/operation-error'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    return await withUserTransaction(userId, async client => {
      await recomputeProductGroupSuggestions(client, userId)
      const suggestions = await listPendingProductGroupSuggestions(client, userId)

      return Response.json(suggestions)
    })
  } catch (error) {
    if (isMissingRelationError(error, 'product_groups')) {
      return Response.json([])
    }

    console.error('Error listing product group suggestions:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_GROUP_SUGGESTIONS_LIST_FAILED',
      message: 'Failed to list product group suggestions',
    }))
  }
}
