import { Pool } from '@neondatabase/serverless'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import {
  ProductGroupResponseSchema,
  UpdateProductGroupSchema,
} from '@/lib/validations'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const groupId = Number(id)

    if (!Number.isInteger(groupId) || groupId <= 0) {
      return Response.json({ error: 'Product group not found' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parsed = UpdateProductGroupSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const result = await client.query(
        `
          UPDATE product_groups
          SET display_name = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND user_id = $3
          RETURNING id, display_name, base_unit
        `,
        [parsed.data.display_name, groupId, userId]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product group not found' }, { status: 404 })
      }

      await client.query('COMMIT')

      const response = ProductGroupResponseSchema.parse(result.rows[0])
      return Response.json(response)
    } catch (error) {
      await client.query('ROLLBACK')

      if (isUniqueViolation(error)) {
        return Response.json({ error: 'Product group already exists' }, { status: 409 })
      }

      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating product group:', error)
    return Response.json({ error: 'Failed to update product group' }, { status: 500 })
  }
}

async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
