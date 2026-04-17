import { Pool } from '@neondatabase/serverless'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import { parseHistoryPeriodDaysParam } from '@/lib/validations'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const rawPeriodDays = searchParams.get('period_days')
  const periodDaysResult = rawPeriodDays === null ? { success: true as const, data: null } : parseHistoryPeriodDaysParam(rawPeriodDays)

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

      const periodDays = periodDaysResult.data
      const likeSearch = `%${search}%`

      const productsResult = await client.query(
        `
          SELECT
            p.id,
            p.normalized_name,
            p.category,
            COUNT(ii.id) FILTER (
              WHERE $4::int IS NULL OR i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
            ) AS purchase_count,
            AVG(ii.unit_price) FILTER (
              WHERE $4::int IS NULL OR i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
            ) AS avg_price,
            MAX(i.purchase_date) FILTER (
              WHERE $4::int IS NULL OR i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
            ) AS last_purchase
          FROM products p
          LEFT JOIN invoice_items ii ON ii.product_id = p.id AND ii.user_id = p.user_id
          LEFT JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = p.user_id
          WHERE p.user_id = $1
            AND ($2 = '' OR p.normalized_name ILIKE $3)
            AND ($5 = '' OR p.category = $5)
          GROUP BY p.id, p.normalized_name, p.category
          HAVING COUNT(ii.id) FILTER (
            WHERE $4::int IS NULL OR i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL '1 day')
          ) > 0
          ORDER BY purchase_count DESC, p.normalized_name ASC
          LIMIT 50
        `,
        [userId, search, likeSearch, periodDays, category]
      )

      const categoriesResult = await client.query(
        `
          SELECT DISTINCT category
          FROM products
          WHERE user_id = $1 AND category IS NOT NULL
          ORDER BY category ASC
        `,
        [userId]
      )

      await client.query('COMMIT')

      return Response.json({
        products: productsResult.rows.map(product => ({
          id: Number(product.id),
          normalized_name: String(product.normalized_name),
          category: product.category ? String(product.category) : null,
          avg_price: Number(product.avg_price) || 0,
          purchase_count: Number(product.purchase_count) || 0,
          last_purchase: product.last_purchase,
        })),
        categories: categoriesResult.rows.map(categoryRow => String(categoryRow.category)),
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
