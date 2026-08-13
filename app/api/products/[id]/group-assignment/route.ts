import { PoolClient } from 'pg'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { backfillComparablePricingForProduct } from '@/lib/backfill-comparable'
import {
  AssignProductGroupSchema,
  ProductGroupAssignmentResponseSchema,
} from '@/lib/validations'
import {
  notFoundError,
  operationErrorResponse,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

type ProductRow = {
  id: number
  comparable_group_id: number | null
  units_per_pack: number | null
}

type GroupRow = {
  id: number
  display_name: string
  base_unit: 'kg' | 'L' | 'un'
}

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
    const productId = Number(id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return operationErrorResponse(validationError('INVALID_PRODUCT_GROUP_ASSIGNMENT', 'Invalid request'))
    }

    const parsed = AssignProductGroupSchema.safeParse(body)
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_PRODUCT_GROUP_ASSIGNMENT',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
    }

    return await withUserTransaction(userId, async (client) => {
      const product = await getProduct(client, productId, userId)
      if (!product) {
        return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
      }

      const group = await getGroup(client, parsed.data.group_id, userId)
      if (!group) {
        return operationErrorResponse(notFoundError('PRODUCT_GROUP_NOT_FOUND', 'Product group not found'))
      }

      if (product.comparable_group_id === group.id) {
        return Response.json(buildAssignmentResponse(product.id, group))
      }

      if (product.comparable_group_id !== null) {
        return operationErrorResponse({
          code: 'PRODUCT_GROUP_ASSIGNMENT_CONFLICT',
          category: 'conflict',
          message: 'Product already assigned to another group',
          retryable: false,
        })
      }

      const latestComparableEvidence = await client.query<{ comparable_base_unit: 'kg' | 'L' }>(
        `
          SELECT ii.comparable_base_unit
          FROM invoice_items ii
          JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = $2
          WHERE ii.product_id = $1
            AND ii.user_id = $2
            AND ii.comparable_base_unit IS NOT NULL
          ORDER BY i.purchase_date DESC, ii.id DESC
          LIMIT 1
        `,
        [productId, userId]
      )

      const evidenceUnit = latestComparableEvidence.rows[0]?.comparable_base_unit ?? null

      if (!evidenceUnit && !parsed.data.allow_missing_comparable_evidence) {
        return operationErrorResponse(validationError(
          'MISSING_COMPARABLE_EVIDENCE',
          'Missing comparable evidence for product'
        ))
      }

      if (evidenceUnit && evidenceUnit !== group.base_unit) {
        return operationErrorResponse(validationError(
          'INCOMPATIBLE_COMPARABLE_EVIDENCE',
          'Comparable evidence base unit is incompatible with product group'
        ))
      }

      await client.query(
        `
          UPDATE products
          SET comparable_group_id = $1
          WHERE id = $2 AND user_id = $3
        `,
        [group.id, product.id, userId]
      )

      await backfillComparablePricingForProduct(client, product.id, userId, group.base_unit, product.units_per_pack)

      await client.query(
        `
          INSERT INTO product_group_membership_events (
            product_id,
            group_id,
            user_id,
            event_type,
            changed_by
          )
          VALUES ($1, $2, $3, 'associate', $4)
        `,
        [product.id, group.id, userId, userId]
      )

      return Response.json(buildAssignmentResponse(product.id, group))
    })
  } catch (error) {
    console.error('Error assigning product group:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_GROUP_ASSIGNMENT_FAILED',
      message: 'Failed to assign product group',
    }))
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const { id } = await params
    const productId = Number(id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
    }

    return await withUserTransaction(userId, async (client) => {
      const product = await getProduct(client, productId, userId)
      if (!product) {
        return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
      }

      if (product.comparable_group_id === null) {
        return new Response(null, { status: 204 })
      }

      await client.query(
        `
          UPDATE products
          SET comparable_group_id = NULL
          WHERE id = $1 AND user_id = $2
        `,
        [product.id, userId]
      )

      await client.query(
        `
          INSERT INTO product_group_membership_events (
            product_id,
            group_id,
            user_id,
            event_type,
            changed_by
          )
          VALUES ($1, $2, $3, 'disassociate', $4)
        `,
        [product.id, product.comparable_group_id, userId, userId]
      )

      return new Response(null, { status: 204 })
    })
  } catch (error) {
    console.error('Error removing product group assignment:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_GROUP_DISASSIGNMENT_FAILED',
      message: 'Failed to remove product group assignment',
    }))
  }
}

async function getProduct(client: PoolClient, productId: number, userId: string) {
  const result = await client.query<ProductRow>(
    `
      SELECT id, comparable_group_id, units_per_pack
      FROM products
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [productId, userId]
  )

  return result.rows[0] ?? null
}

async function getGroup(client: PoolClient, groupId: number, userId: string) {
  const result = await client.query<GroupRow>(
    `
      SELECT id, display_name, base_unit
      FROM product_groups
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [groupId, userId]
  )

  return result.rows[0] ?? null
}

function buildAssignmentResponse(productId: number, group: GroupRow) {
  return ProductGroupAssignmentResponseSchema.parse({
    product_id: productId,
    group_id: group.id,
    display_name: group.display_name,
    base_unit: group.base_unit,
  })
}

async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
