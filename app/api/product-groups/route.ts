import { getSessionUserId } from '@/lib/auth-session'
import { isMissingRelationError } from '@/lib/db-errors'
import { withUserTransaction } from '@/lib/session-sql'
import {
  CreateProductGroupSchema,
  ProductGroupResponseSchema,
  parseHistoryPeriodDaysParam,
} from '@/lib/validations'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view')
  const search = searchParams.get('search')?.trim() ?? ''
  const baseUnit = searchParams.get('base_unit')?.trim() ?? ''

  if (view !== 'comparable' && view !== 'all') {
    return Response.json({ error: 'Invalid view' }, { status: 400 })
  }

  const periodDaysResult = view === 'comparable'
    ? parseHistoryPeriodDaysParam(searchParams.get('period_days'))
    : { success: true as const, data: null }

  if (!periodDaysResult.success) {
    return Response.json({ error: 'Invalid period_days' }, { status: 400 })
  }

  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return await withUserTransaction(userId, async (client) => {
      const groupsResult = view === 'comparable'
        ? await client.query(
            `
              SELECT
                pg.id,
                pg.display_name,
                pg.base_unit,
                COUNT(CASE WHEN i.id IS NOT NULL THEN ii.id END) AS comparable_occurrences,
                MIN(CASE WHEN i.id IS NOT NULL THEN ii.comparable_unit_price END) AS min_unit_price,
                AVG(CASE WHEN i.id IS NOT NULL THEN ii.comparable_unit_price END) AS avg_unit_price,
                MAX(CASE WHEN i.id IS NOT NULL THEN ii.comparable_unit_price END) AS max_unit_price
              FROM product_groups pg
              JOIN products p ON p.comparable_group_id = pg.id AND p.user_id = pg.user_id
              LEFT JOIN invoice_items ii ON ii.product_id = p.id
                AND ii.user_id = pg.user_id
                AND ii.comparable_unit_price IS NOT NULL
                AND ii.comparable_base_unit = pg.base_unit
              LEFT JOIN invoices i ON i.id = ii.invoice_id
                AND i.user_id = pg.user_id
                AND i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
              WHERE pg.user_id = $1
                AND (
                  $2 = ''
                  OR pg.display_name ILIKE $3
                  OR EXISTS (
                    SELECT 1
                    FROM products search_products
                    WHERE search_products.comparable_group_id = pg.id
                      AND search_products.user_id = pg.user_id
                      AND (
                        search_products.normalized_name ILIKE $3
                        OR COALESCE(search_products.brand, '') ILIKE $3
                      )
                  )
                )
              GROUP BY pg.id, pg.display_name, pg.base_unit
              ORDER BY pg.display_name ASC
              LIMIT 50
            `,
            [userId, search, `%${search}%`, periodDaysResult.data]
          )
        : await client.query(
            `
              SELECT
                pg.id,
                pg.display_name,
                pg.base_unit,
                0::integer AS comparable_occurrences,
                0::numeric AS min_unit_price,
                0::numeric AS avg_unit_price,
                0::numeric AS max_unit_price
              FROM product_groups pg
              WHERE pg.user_id = $1
                AND ($2 = '' OR pg.display_name ILIKE $3)
                AND ($4 = '' OR pg.base_unit = $4)
              ORDER BY pg.display_name ASC
              LIMIT 50
            `,
            [userId, search, `%${search}%`, baseUnit]
          )

      return Response.json({
        groups: groupsResult.rows.map(group => ({
          id: Number(group.id),
          display_name: String(group.display_name),
          base_unit: group.base_unit,
          comparable_occurrences: Number(group.comparable_occurrences) || 0,
          min_unit_price: Number(group.min_unit_price) || 0,
          avg_unit_price: Number(group.avg_unit_price) || 0,
          max_unit_price: Number(group.max_unit_price) || 0,
        })),
      })
    })
  } catch (error) {
    if (isMissingRelationError(error, 'product_groups')) {
      return Response.json({ groups: [] })
    }

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

    return await withUserTransaction(userId, async (client) => {
      try {
        const result = await client.query(
        `INSERT INTO product_groups (display_name, base_unit, user_id)
         VALUES ($1, $2, $3)
         RETURNING id, display_name, base_unit`,
        [parsed.data.display_name, parsed.data.base_unit, userId]
        )
        const response = ProductGroupResponseSchema.parse(result.rows[0])
        return Response.json(response, { status: 201 })
      } catch (error) {
        if (isUniqueViolation(error)) {
          return Response.json({ error: 'Product group already exists' }, { status: 409 })
        }
        throw error
      }
    })
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
