import { PoolClient } from 'pg'
import { getPool } from '@/lib/db-pool'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import { backfillComparablePricingForProduct } from '@/lib/backfill-comparable'
import {
  AssignProductGroupSchema,
  ProductGroupAssignmentResponseSchema,
} from '@/lib/validations'

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
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const productId = Number(id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parsed = AssignProductGroupSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const client = await getPool().connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const product = await getProduct(client, productId, userId)
      if (!product) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product not found' }, { status: 404 })
      }

      const group = await getGroup(client, parsed.data.group_id, userId)
      if (!group) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product group not found' }, { status: 404 })
      }

      if (product.comparable_group_id === group.id) {
        await client.query('COMMIT')
        return Response.json(buildAssignmentResponse(product.id, group))
      }

      if (product.comparable_group_id !== null) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product already assigned to another group' }, { status: 409 })
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
        await client.query('ROLLBACK')
        return Response.json({ error: 'Missing comparable evidence for product' }, { status: 400 })
      }

      if (evidenceUnit && evidenceUnit !== group.base_unit) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Comparable evidence base unit is incompatible with product group' }, { status: 400 })
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

      await client.query('COMMIT')
      return Response.json(buildAssignmentResponse(product.id, group))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error assigning product group:', error)
    return Response.json({ error: 'Failed to assign product group' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const productId = Number(id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    const client = await getPool().connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const product = await getProduct(client, productId, userId)
      if (!product) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product not found' }, { status: 404 })
      }

      if (product.comparable_group_id === null) {
        await client.query('COMMIT')
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

      await client.query('COMMIT')
      return new Response(null, { status: 204 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error removing product group assignment:', error)
    return Response.json({ error: 'Failed to remove product group assignment' }, { status: 500 })
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
