import { getPool } from '@/lib/db-pool'
import { getSessionUserId } from '@/lib/auth-session'
import { isMissingRelationError } from '@/lib/db-errors'
import { setAppUserId } from '@/lib/session-sql'
import {
  listPendingProductGroupSuggestions,
  recomputeProductGroupSuggestions,
} from '@/lib/product-group-suggestions'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getPool().connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      await recomputeProductGroupSuggestions(client, userId)
      const suggestions = await listPendingProductGroupSuggestions(client, userId)

      await client.query('COMMIT')
      return Response.json(suggestions)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    if (isMissingRelationError(error, 'product_groups')) {
      return Response.json([])
    }

    console.error('Error listing product group suggestions:', error)
    return Response.json({ error: 'Failed to list product group suggestions' }, { status: 500 })
  }
}
