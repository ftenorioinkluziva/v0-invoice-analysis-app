import { Pool } from '@neondatabase/serverless'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import { rejectProductGroupSuggestion } from '@/lib/product-group-suggestions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const suggestionId = Number(id)
    if (!Number.isInteger(suggestionId) || suggestionId <= 0) {
      return Response.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const result = await rejectProductGroupSuggestion(client, suggestionId, userId)
      if (result.kind === 'not_found') {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Suggestion not found' }, { status: 404 })
      }

      if (result.kind === 'invalid') {
        await client.query('ROLLBACK')
        return Response.json({ error: result.message }, { status: 400 })
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
    console.error('Error rejecting product group suggestion:', error)
    return Response.json({ error: 'Failed to reject product group suggestion' }, { status: 500 })
  }
}
