import { Pool } from '@neondatabase/serverless'
import { getSessionUserId } from '@/lib/auth-session'
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

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

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
    console.error('Error listing product group suggestions:', error)
    return Response.json({ error: 'Failed to list product group suggestions' }, { status: 500 })
  }
}
