import { CreateShoppingListSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { operationErrorResponse, readJsonBody, toOperationError, unauthorizedError, validationError } from '@/lib/operation-error'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    return await withUserTransaction(userId, async (client) => {
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
    })
  } catch (error) {
    console.error('Error fetching shopping lists:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'SHOPPING_LISTS_FETCH_FAILED',
      message: 'Failed to fetch shopping lists',
    }))
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const parsed = CreateShoppingListSchema.safeParse(await readJsonBody(request))
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_SHOPPING_LIST_REQUEST',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
    }
    const { name } = parsed.data

    return await withUserTransaction(userId, async (client) => {
      const result = await client.query(
        `INSERT INTO shopping_lists (name, status, user_id)
         VALUES ($1, 'active', $2)
         RETURNING id, name, status, created_at`,
        [name || 'Nova Lista', userId]
      )
      return Response.json({ list: result.rows[0] })
    })
  } catch (error) {
    console.error('Error creating shopping list:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'SHOPPING_LIST_CREATE_FAILED',
      message: 'Failed to create shopping list',
    }))
  }
}
