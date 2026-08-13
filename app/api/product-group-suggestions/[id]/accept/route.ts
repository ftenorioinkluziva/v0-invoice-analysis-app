import { Pool } from 'pg'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import { acceptProductGroupSuggestion } from '@/lib/product-group-suggestions'
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

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const result = await acceptProductGroupSuggestion(client, suggestionId, userId)
      if (result.kind === 'not_found') {
        await client.query('ROLLBACK')
        return operationErrorResponse(notFoundError('SUGGESTION_NOT_FOUND', 'Suggestion not found'))
      }

      if (result.kind === 'invalid') {
        await client.query('ROLLBACK')
        return operationErrorResponse({
          code: 'SUGGESTION_STATE_CONFLICT',
          category: 'conflict',
          message: result.message,
          retryable: false,
        })
      }

      await client.query('COMMIT')
      return Response.json(result.suggestion)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error accepting product group suggestion:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'SUGGESTION_ACCEPT_FAILED',
      message: 'Failed to accept product group suggestion',
    }))
  }
}
