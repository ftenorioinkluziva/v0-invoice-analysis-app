import { Pool } from '@neondatabase/serverless'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import { ProductResponseSchema, UpdateProductSchema, parseHistoryPeriodDaysParam } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url)
  const periodDaysResult = parseHistoryPeriodDaysParam(searchParams.get('period_days'))

  if (!periodDaysResult.success) {
    return Response.json({ error: 'Invalid period_days' }, { status: 400 })
  }

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

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const periodDays = periodDaysResult.data

      const product = await client.query(
        `
          SELECT id, normalized_name, category
          FROM products
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
        [productId, userId]
      )

      if (product.rows.length === 0) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product not found' }, { status: 404 })
      }

      const priceHistory = await client.query(
        `
          SELECT
            ii.unit_price AS price,
            ii.raw_description,
            i.purchase_date AS date,
            s.name AS store_name
          FROM invoice_items ii
          JOIN invoices i ON ii.invoice_id = i.id AND i.user_id = ii.user_id
          JOIN stores s ON i.store_id = s.id AND s.user_id = ii.user_id
          WHERE ii.product_id = $1
            AND ii.user_id = $2
            AND i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
          ORDER BY i.purchase_date DESC
          LIMIT 20
        `,
        [productId, userId, periodDays]
      )

      const stats = await client.query(
        `
          SELECT
            AVG(ii.unit_price) AS avg_price,
            MIN(ii.unit_price) AS min_price,
            MAX(ii.unit_price) AS max_price
          FROM invoice_items ii
          JOIN invoices i ON ii.invoice_id = i.id AND i.user_id = ii.user_id
          WHERE ii.product_id = $1
            AND ii.user_id = $2
            AND i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
        `,
        [productId, userId, periodDays]
      )

      const variationResult = await client.query(
        `
          WITH filtered_prices AS (
            SELECT ii.unit_price, i.purchase_date
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id AND i.user_id = ii.user_id
            WHERE ii.product_id = $1
              AND ii.user_id = $2
              AND i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
          ),
          first_last AS (
            SELECT
              (SELECT unit_price FROM filtered_prices ORDER BY purchase_date ASC LIMIT 1) AS first_price,
              (SELECT unit_price FROM filtered_prices ORDER BY purchase_date DESC LIMIT 1) AS last_price
          )
          SELECT
            CASE
              WHEN first_price > 0 THEN ((last_price - first_price) / first_price) * 100
              ELSE 0
            END AS variation
          FROM first_last
        `,
        [productId, userId, periodDays]
      )

      await client.query('COMMIT')

      return Response.json({
        product_id: Number(product.rows[0].id),
        product_name: String(product.rows[0].normalized_name),
        category: product.rows[0].category ? String(product.rows[0].category) : null,
        prices: priceHistory.rows.map(row => ({
          date: row.date,
          price: Number(row.price),
          store_name: String(row.store_name),
          raw_description: String(row.raw_description),
        })),
        stats: {
          avg_price: Number(stats.rows[0]?.avg_price) || 0,
          min_price: Number(stats.rows[0]?.min_price) || 0,
          max_price: Number(stats.rows[0]?.max_price) || 0,
          price_variation_6m: Number(variationResult.rows[0]?.variation) || 0,
        },
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching product history:', error)
    return Response.json({ error: 'Failed to fetch product history' }, { status: 500 })
  }
}

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
    const productId = Number(id)

    if (!Number.isInteger(productId) || productId <= 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await readJsonBody(request)
    if (body === null) {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    const parsed = UpdateProductSchema.safeParse(body)
    if (!parsed.success || parsed.data.brand === undefined) {
      return Response.json({ error: 'Invalid request', details: parsed.success ? undefined : parsed.error.flatten() }, { status: 400 })
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const result = await client.query(
        `
          UPDATE products
          SET brand = $1
          WHERE id = $2 AND user_id = $3
          RETURNING id, brand
        `,
        [parsed.data.brand, productId, userId]
      )

      if (result.rows.length === 0) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product not found' }, { status: 404 })
      }

      await client.query('COMMIT')
      return Response.json(ProductResponseSchema.parse(result.rows[0]))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error updating product:', error)
    return Response.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

async function readJsonBody(request: Request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}
