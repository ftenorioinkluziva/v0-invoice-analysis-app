import { sql } from '@/lib/db'
import { DashboardStats } from '@/lib/types'

export async function GET() {
  try {
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 7)

    // Total spent this month
    const currentMonthSpent = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM invoices
      WHERE TO_CHAR(purchase_date, 'YYYY-MM') = ${currentMonth}
    `

    // Total spent last month
    const lastMonthSpent = await sql`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM invoices
      WHERE TO_CHAR(purchase_date, 'YYYY-MM') = ${lastMonth}
    `

    const totalThisMonth = Number(currentMonthSpent[0].total)
    const totalLastMonth = Number(lastMonthSpent[0].total)
    const monthVariation = totalLastMonth > 0 
      ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100 
      : 0

    // Total invoices and products
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM invoices) as invoice_count,
        (SELECT COUNT(*) FROM products) as product_count
    `

    const spendingByMonth = await sql`
      SELECT
        TO_CHAR(purchase_date, 'YYYY-MM') as month,
        SUM(total_amount) as total
      FROM invoices
      GROUP BY TO_CHAR(purchase_date, 'YYYY-MM')
      ORDER BY month ASC
    `

    // Top price increases
    const priceIncreases = await sql`
      WITH recent_prices AS (
        SELECT 
          p.id as product_id,
          p.normalized_name as product_name,
          ii.unit_price,
          i.purchase_date,
          ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY i.purchase_date DESC) as rn
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.purchase_date >= NOW() - INTERVAL '3 months'
      ),
      price_comparison AS (
        SELECT 
          r1.product_id,
          r1.product_name,
          r1.unit_price as current_price,
          r2.unit_price as previous_price,
          CASE 
            WHEN r2.unit_price > 0 
            THEN ((r1.unit_price - r2.unit_price) / r2.unit_price) * 100
            ELSE 0
          END as price_variation
        FROM recent_prices r1
        JOIN recent_prices r2 ON r1.product_id = r2.product_id AND r2.rn = 2
        WHERE r1.rn = 1
      )
      SELECT *
      FROM price_comparison
      WHERE price_variation > 5
      ORDER BY price_variation DESC
      LIMIT 5
    `

    // Calculate personal inflation index
    const inflationResult = await sql`
      WITH product_prices AS (
        SELECT 
          p.id,
          p.normalized_name,
          AVG(CASE 
            WHEN i.purchase_date >= NOW() - INTERVAL '1 month' 
            THEN ii.unit_price 
          END) as current_avg,
          AVG(CASE 
            WHEN i.purchase_date >= NOW() - INTERVAL '3 months' 
              AND i.purchase_date < NOW() - INTERVAL '1 month'
            THEN ii.unit_price 
          END) as previous_avg,
          COUNT(ii.id) as purchase_count
        FROM products p
        JOIN invoice_items ii ON ii.product_id = p.id
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.purchase_date >= NOW() - INTERVAL '3 months'
        GROUP BY p.id, p.normalized_name
        HAVING COUNT(ii.id) >= 2
      ),
      weighted_inflation AS (
        SELECT 
          SUM(
            CASE 
              WHEN previous_avg > 0 AND current_avg IS NOT NULL
              THEN ((current_avg - previous_avg) / previous_avg) * purchase_count
              ELSE 0
            END
          ) / NULLIF(SUM(purchase_count), 0) * 100 as inflation
        FROM product_prices
        WHERE current_avg IS NOT NULL AND previous_avg IS NOT NULL
      )
      SELECT COALESCE(inflation, 0) as inflation FROM weighted_inflation
    `

    const stats: DashboardStats = {
      total_spent_month: totalThisMonth,
      total_spent_last_month: totalLastMonth,
      month_variation_percent: monthVariation,
      total_invoices: Number(counts[0].invoice_count),
      total_products: Number(counts[0].product_count),
      personal_inflation: Number(inflationResult[0].inflation) || 0,
      top_price_increases: priceIncreases.map(row => ({
        product_name: row.product_name,
        price_variation: Number(row.price_variation),
        current_price: Number(row.current_price),
        previous_price: Number(row.previous_price),
      })),
      spending_by_month: spendingByMonth.map(row => ({
        month: row.month,
        total: Number(row.total),
      })),
    }

    return Response.json(stats)
  } catch (error) {
    console.error('Error fetching analytics:', error)
    return Response.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
