import { getPool } from '@/lib/db-pool'
import { CreateShoppingListSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await getPool().connect()
    try {
      const result = await client.query(
        `
          SELECT
            sl.id,
            sl.name,
            sl.status,
            sl.created_at,
            COUNT(sli.id) AS item_count,
            SUM(CASE WHEN sli.checked THEN 1 ELSE 0 END) AS checked_count,
            SUM(COALESCE(sli.estimated_price, 0) * sli.quantity) AS estimated_total
          FROM shopping_lists sl
          LEFT JOIN shopping_list_items sli ON sl.id = sli.list_id AND sli.user_id = sl.user_id
          WHERE sl.user_id = $1
          GROUP BY sl.id, sl.name, sl.status, sl.created_at
          ORDER BY sl.created_at DESC
        `,
        [userId]
      )
      return Response.json({ lists: result.rows })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching shopping lists:', error)
    return Response.json({ error: 'Failed to fetch shopping lists' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = CreateShoppingListSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { name } = parsed.data

    const client = await getPool().connect()
    try {
      const result = await client.query(
        `INSERT INTO shopping_lists (name, status, user_id)
         VALUES ($1, 'active', $2)
         RETURNING id, name, status, created_at`,
        [name || 'Nova Lista', userId]
      )
      return Response.json({ list: result.rows[0] })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error creating shopping list:', error)
    return Response.json({ error: 'Failed to create shopping list' }, { status: 500 })
  }
}
