import { UpdateAlertSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alerts = await withUserTransaction(userId, async (client) => {
      const result = await client.query(`
      SELECT 
        a.id,
        a.alert_type,
        a.message,
        a.data,
        a.read,
        a.created_at,
        p.normalized_name as product_name,
        p.category
      FROM alerts a
      JOIN products p ON a.product_id = p.id
      WHERE a.user_id = $1 AND p.user_id = $1
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [userId])
      return result.rows
    })
    return Response.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return Response.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = UpdateAlertSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, read } = parsed.data

    await withUserTransaction(userId, async (client) => {
      await client.query(
        'UPDATE alerts SET read = $1 WHERE id = $2 AND user_id = $3',
        [read, id, userId]
      )
    })
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating alert:', error)
    return Response.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
