import { Pool } from 'pg'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import {
  ProductGroupResponseSchema,
  UpdateProductGroupSchema,
} from '@/lib/validations'
import {
  notFoundError,
  operationErrorResponse,
  readJsonBody,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const { id } = await params
    const groupId = Number(id)

    if (!Number.isInteger(groupId) || groupId <= 0) {
      return operationErrorResponse(notFoundError('PRODUCT_GROUP_NOT_FOUND', 'Product group not found'))
    }

    const body = await readJsonBody(request)

    const parsed = UpdateProductGroupSchema.safeParse(body)
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_PRODUCT_GROUP_UPDATE_REQUEST',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
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
        return operationErrorResponse(notFoundError('PRODUCT_GROUP_NOT_FOUND', 'Product group not found'))
      }

      await client.query('COMMIT')

      const response = ProductGroupResponseSchema.parse(result.rows[0])
      return Response.json(response)
    } catch (error) {
      await client.query('ROLLBACK')

      if (isUniqueViolation(error)) {
        return operationErrorResponse({
          code: 'PRODUCT_GROUP_ALREADY_EXISTS',
          category: 'conflict',
          message: 'Product group already exists',
          retryable: false,
        })
      }

      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating product group:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_GROUP_UPDATE_FAILED',
      message: 'Failed to update product group',
    }))
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
