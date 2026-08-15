import { getSessionUserId } from '@/lib/auth-session'
import { ProductResponseSchema, UpdateProductSchema, parseHistoryPeriodDaysParam } from '@/lib/validations'
import { withUserTransaction } from '@/lib/session-sql'
import {
  notFoundError,
  operationErrorResponse,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url)
  const periodDaysResult = parseHistoryPeriodDaysParam(searchParams.get('period_days'))

  if (!periodDaysResult.success) {
    return operationErrorResponse(validationError('INVALID_PERIOD_DAYS', 'Invalid period_days'))
  }

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
      const periodDays = periodDaysResult.data

      // 1 roundtrip: produto + histórico + stats + variação via CTEs
      const result = await client.query(
        `
          WITH latest_comparable_evidence AS (
            SELECT DISTINCT ON (ii.product_id)
              ii.product_id,
              ii.comparable_base_unit
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = ii.user_id
            WHERE ii.product_id = $1 AND ii.user_id = $2
              AND ii.comparable_base_unit IS NOT NULL
            ORDER BY ii.product_id, i.purchase_date DESC, ii.id DESC
          ),
          product_row AS (
            SELECT
              p.id, p.normalized_name, p.category, p.brand, p.units_per_pack,
              lce.comparable_base_unit,
              pg.id AS comparable_group_id,
              pg.display_name AS comparable_group_display_name,
              pg.base_unit AS comparable_group_base_unit
            FROM products p
            LEFT JOIN latest_comparable_evidence lce ON lce.product_id = p.id
            LEFT JOIN product_groups pg ON pg.id = p.comparable_group_id AND pg.user_id = p.user_id
            WHERE p.id = $1 AND p.user_id = $2
            LIMIT 1
          ),
          price_history AS (
            SELECT
              ii.unit_price AS price,
              ii.raw_description,
              i.purchase_date AS date,
              s.name AS store_name
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id AND i.user_id = ii.user_id
            JOIN stores s ON i.store_id = s.id AND s.user_id = ii.user_id
            WHERE ii.product_id = $1 AND ii.user_id = $2
              AND (
                $3::int IS NULL
                OR i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
              )
            ORDER BY i.purchase_date DESC
            LIMIT 20
          ),
          price_stats AS (
            SELECT
              AVG(ii.unit_price) AS avg_price,
              MIN(ii.unit_price) AS min_price,
              MAX(ii.unit_price) AS max_price,
              (SELECT unit_price FROM invoice_items ii2
                JOIN invoices i2 ON ii2.invoice_id = i2.id AND i2.user_id = ii2.user_id
                WHERE ii2.product_id = $1 AND ii2.user_id = $2
                  AND (
                    $3::int IS NULL
                    OR i2.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
                  )
                ORDER BY i2.purchase_date ASC LIMIT 1) AS first_price,
              (SELECT unit_price FROM invoice_items ii3
                JOIN invoices i3 ON ii3.invoice_id = i3.id AND i3.user_id = ii3.user_id
                WHERE ii3.product_id = $1 AND ii3.user_id = $2
                  AND (
                    $3::int IS NULL
                    OR i3.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
                  )
                ORDER BY i3.purchase_date DESC LIMIT 1) AS last_price
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id AND i.user_id = ii.user_id
            WHERE ii.product_id = $1 AND ii.user_id = $2
              AND (
                $3::int IS NULL
                OR i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
              )
          )
          SELECT
            (SELECT row_to_json(product_row) FROM product_row) AS product,
            COALESCE((SELECT json_agg(price_history ORDER BY date DESC) FROM price_history), '[]') AS prices,
            (SELECT row_to_json(ps) FROM (
              SELECT
                avg_price, min_price, max_price,
                CASE WHEN first_price > 0 THEN ((last_price - first_price) / first_price) * 100 ELSE 0 END AS variation
              FROM price_stats
            ) ps) AS stats
        `,
        [productId, userId, periodDays]
      )

      const row = result.rows[0]
      if (!row.product) {
        return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
      }

      const p = row.product
      const stats = row.stats ?? { avg_price: 0, min_price: 0, max_price: 0, variation: 0 }
      const prices: Record<string, unknown>[] = row.prices

      return Response.json({
        product_id: Number(p.id),
        product_name: String(p.normalized_name),
        category: p.category ? String(p.category) : null,
        brand: p.brand ? String(p.brand) : null,
        units_per_pack: p.units_per_pack != null ? Number(p.units_per_pack) : null,
        comparable_base_unit: p.comparable_base_unit ?? null,
        comparable_group: p.comparable_group_id
          ? {
              id: Number(p.comparable_group_id),
              display_name: String(p.comparable_group_display_name),
              base_unit: p.comparable_group_base_unit,
            }
          : null,
        prices: prices.map(r => ({
          date: r.date,
          price: Number(r.price),
          store_name: String(r.store_name),
          raw_description: String(r.raw_description),
        })),
        stats: {
          avg_price: Number(stats.avg_price) || 0,
          min_price: Number(stats.min_price) || 0,
          max_price: Number(stats.max_price) || 0,
          price_variation_6m: Number(stats.variation) || 0,
        },
      })
    })
  } catch (error) {
    console.error('Error fetching product history:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_HISTORY_FAILED',
      message: 'Failed to fetch product history',
    }))
  }
}

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
    const productId = Number(id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return operationErrorResponse(validationError('INVALID_PRODUCT_REQUEST', 'Invalid request'))
    }

    const parsed = UpdateProductSchema.safeParse(body)
    if (!parsed.success || (parsed.data.brand === undefined && parsed.data.units_per_pack === undefined)) {
      return operationErrorResponse(
        validationError(
          'INVALID_PRODUCT_REQUEST',
          'Invalid request',
          parsed.success ? undefined : parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: parsed.success ? undefined : { details: parsed.error.flatten() } }
      )
    }

    const setClauses: string[] = []
    const values: unknown[] = []
    let idx = 1

    if (parsed.data.brand !== undefined) {
      setClauses.push(`brand = $${idx++}`)
      values.push(parsed.data.brand)
    }
    if (parsed.data.units_per_pack !== undefined) {
      setClauses.push(`units_per_pack = $${idx++}`)
      values.push(parsed.data.units_per_pack)
    }

    values.push(productId, userId)
    return await withUserTransaction(userId, async (client) => {
      const result = await client.query(
        `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING id, brand, units_per_pack`,
        values
      )
      if (result.rows.length === 0) {
        return operationErrorResponse(notFoundError('PRODUCT_NOT_FOUND', 'Product not found'))
      }
      return Response.json(ProductResponseSchema.parse(result.rows[0]))
    })
  } catch (error) {
    console.error('Error updating product:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PRODUCT_UPDATE_FAILED',
      message: 'Failed to update product',
    }))
  }
}

async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
