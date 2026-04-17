import { Pool } from '@neondatabase/serverless'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import {
  CreateProductGroupSchema,
  ProductGroupResponseSchema,
  parseHistoryPeriodDaysParam,
} from '@/lib/validations'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view')
  const search = searchParams.get('search')?.trim() ?? ''
  const periodDaysResult = parseHistoryPeriodDaysParam(searchParams.get('period_days'))

  if (view !== 'comparable') {
    return Response.json({ error: 'Invalid view' }, { status: 400 })
  }

  if (!periodDaysResult.success) {
    return Response.json({ error: 'Invalid period_days' }, { status: 400 })
  }

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

      const comparableGroups = await client.query(
        `
          SELECT
            pg.id,
            pg.display_name,
            pg.base_unit,
            MIN(ii.comparable_unit_price) AS min_unit_price,
            AVG(ii.comparable_unit_price) AS avg_unit_price,
            MAX(ii.comparable_unit_price) AS max_unit_price
          FROM product_groups pg
          JOIN products p ON p.comparable_group_id = pg.id AND p.user_id = pg.user_id
          JOIN invoice_items ii ON ii.product_id = p.id AND ii.user_id = pg.user_id
          JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = pg.user_id
          WHERE pg.user_id = $1
            AND ($2 = '' OR pg.display_name ILIKE $3)
            AND ii.comparable_unit_price IS NOT NULL
            AND ii.comparable_base_unit = pg.base_unit
            AND i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
          GROUP BY pg.id, pg.display_name, pg.base_unit
          ORDER BY pg.display_name ASC
          LIMIT 50
        `,
        [userId, search, `%${search}%`, periodDaysResult.data]
      )

      await client.query('COMMIT')

      return Response.json({
        groups: comparableGroups.rows.map(group => ({
          id: Number(group.id),
          display_name: String(group.display_name),
          base_unit: group.base_unit,
          min_unit_price: Number(group.min_unit_price) || 0,
          avg_unit_price: Number(group.avg_unit_price) || 0,
          max_unit_price: Number(group.max_unit_price) || 0,
        })),
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching comparable product groups:', error)
    return Response.json({ error: 'Failed to fetch product groups' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parsed = CreateProductGroupSchema.safeParse(body)
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
          INSERT INTO product_groups (display_name, base_unit, user_id)
          VALUES ($1, $2, $3)
          RETURNING id, display_name, base_unit
        `,
        [parsed.data.display_name, parsed.data.base_unit, userId]
      )

      await client.query('COMMIT')

      const response = ProductGroupResponseSchema.parse(result.rows[0])
      return Response.json(response, { status: 201 })
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
    console.error('Error creating product group:', error)
    return Response.json({ error: 'Failed to create product group' }, { status: 500 })
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
