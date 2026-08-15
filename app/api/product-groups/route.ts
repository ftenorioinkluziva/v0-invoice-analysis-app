import { getSessionUserId } from '@/lib/auth-session'
import { isMissingRelationError } from '@/lib/db-errors'
import { withUserTransaction } from '@/lib/session-sql'
import { buildSearchPatterns } from '@/lib/search'
import {
  CreateProductGroupSchema,
  ProductGroupResponseSchema,
  parseHistoryPeriodDaysParam,
} from '@/lib/validations'
import {
  operationErrorResponse,
  readJsonBody,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view')
  const search = searchParams.get('search')?.trim() ?? ''
  const searchPatterns = buildSearchPatterns(search)
  const baseUnit = searchParams.get('base_unit')?.trim() ?? ''

  if (view !== 'comparable' && view !== 'all') {
    return operationErrorResponse(validationError('INVALID_PRODUCT_GROUP_VIEW', 'Invalid view'))
  }

  const periodDaysResult = view === 'comparable'
    ? parseHistoryPeriodDaysParam(searchParams.get('period_days'))
    : { success: true as const, data: null }

  if (!periodDaysResult.success) {
    return operationErrorResponse(validationError('INVALID_PERIOD_DAYS', 'Invalid period_days'))
  }

  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
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
                AND (
                  $4::int IS NULL
                  OR i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
                )
              WHERE pg.user_id = $1
                AND (
                  $2 = ''
                  OR NOT EXISTS (
                    SELECT 1
                    FROM unnest($3::text[]) AS search_term(pattern)
                    WHERE NOT (
                      pg.display_name ILIKE search_term.pattern
                      OR EXISTS (
                        SELECT 1
                        FROM products search_products
                        WHERE search_products.comparable_group_id = pg.id
                          AND search_products.user_id = pg.user_id
                          AND (
                            search_products.normalized_name ILIKE search_term.pattern
                            OR COALESCE(search_products.brand, '') ILIKE search_term.pattern
                          )
                      )
                    )
                  )
                )
              GROUP BY pg.id, pg.display_name, pg.base_unit
              ORDER BY pg.display_name ASC
              LIMIT 50
            `,
            [userId, search, searchPatterns, periodDaysResult.data]
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
                AND ($2 = '' OR pg.display_name ILIKE ALL($3::text[]))
                AND ($4 = '' OR pg.base_unit = $4)
              ORDER BY pg.display_name ASC
              LIMIT 50
            `,
            [userId, search, searchPatterns, baseUnit]
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
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_GROUPS_FETCH_FAILED',
      message: 'Failed to fetch product groups',
    }))
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const body = await readJsonBody(request)

    const parsed = CreateProductGroupSchema.safeParse(body)
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_PRODUCT_GROUP_REQUEST',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
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
          return operationErrorResponse({
            code: 'PRODUCT_GROUP_ALREADY_EXISTS',
            category: 'conflict',
            message: 'Product group already exists',
            retryable: false,
          })
        }
        throw error
      }
    })
  } catch (error) {
    console.error('Error creating product group:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_GROUP_CREATE_FAILED',
      message: 'Failed to create product group',
    }))
  }
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}
