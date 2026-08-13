import type { PoolClient } from 'pg'
import type {
  AnalyticsCounts,
  AnalyticsRepository,
  PriceIncrease,
  SpendingByMonth,
} from '@/lib/analytics'

export function createPgAnalyticsRepository(
  client: PoolClient,
  userId: string
): AnalyticsRepository {
  return {
    async getMonthSpent(month) {
      const result = await client.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM invoices
        WHERE TO_CHAR(purchase_date, 'YYYY-MM') = $1 AND user_id = $2
      `, [month, userId])
      return Number(result.rows[0]?.total ?? 0)
    },

    async getCounts(): Promise<AnalyticsCounts> {
      const result = await client.query(`
        SELECT
          (SELECT COUNT(*) FROM invoices WHERE user_id = $1) AS invoice_count,
          (SELECT COUNT(*) FROM products WHERE user_id = $1) AS product_count
      `, [userId])
      return {
        invoiceCount: Number(result.rows[0]?.invoice_count ?? 0),
        productCount: Number(result.rows[0]?.product_count ?? 0),
      }
    },

    async getSpendingByMonth(): Promise<SpendingByMonth[]> {
      const result = await client.query(`
        SELECT
          TO_CHAR(purchase_date, 'YYYY-MM') AS month,
          SUM(total_amount) AS total
        FROM invoices
        WHERE user_id = $1
        GROUP BY TO_CHAR(purchase_date, 'YYYY-MM')
        ORDER BY month ASC
      `, [userId])
      return result.rows.map(row => ({
        month: String(row.month),
        total: Number(row.total),
      }))
    },

    async getTopPriceIncreases(): Promise<PriceIncrease[]> {
      const result = await client.query(`
        WITH recent_prices AS (
          SELECT
            p.id AS product_id,
            p.normalized_name AS product_name,
            ii.unit_price,
            i.purchase_date,
            ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY i.purchase_date DESC) AS rn
          FROM invoice_items ii
          JOIN products p ON ii.product_id = p.id
          JOIN invoices i ON ii.invoice_id = i.id
          WHERE i.purchase_date >= NOW() - INTERVAL '3 months'
            AND ii.user_id = $1
            AND p.user_id = $1
            AND i.user_id = $1
        ),
        price_comparison AS (
          SELECT
            r1.product_id,
            r1.product_name,
            r1.unit_price AS current_price,
            r2.unit_price AS previous_price,
            CASE
              WHEN r2.unit_price > 0
              THEN ((r1.unit_price - r2.unit_price) / r2.unit_price) * 100
              ELSE 0
            END AS price_variation
          FROM recent_prices r1
          JOIN recent_prices r2 ON r1.product_id = r2.product_id AND r2.rn = 2
          WHERE r1.rn = 1
        )
        SELECT *
        FROM price_comparison
        WHERE price_variation > 5
        ORDER BY price_variation DESC
        LIMIT 5
      `, [userId])
      return result.rows.map(row => ({
        productName: String(row.product_name),
        priceVariation: Number(row.price_variation),
        currentPrice: Number(row.current_price),
        previousPrice: Number(row.previous_price),
      }))
    },

    async getPersonalInflation() {
      const result = await client.query(`
        WITH product_prices AS (
          SELECT
            p.id,
            p.normalized_name,
            AVG(CASE
              WHEN i.purchase_date >= NOW() - INTERVAL '1 month'
              THEN ii.unit_price
            END) AS current_avg,
            AVG(CASE
              WHEN i.purchase_date >= NOW() - INTERVAL '3 months'
                AND i.purchase_date < NOW() - INTERVAL '1 month'
              THEN ii.unit_price
            END) AS previous_avg,
            COUNT(ii.id) AS purchase_count
          FROM products p
          JOIN invoice_items ii ON ii.product_id = p.id
          JOIN invoices i ON ii.invoice_id = i.id
          WHERE i.purchase_date >= NOW() - INTERVAL '3 months'
            AND p.user_id = $1
            AND ii.user_id = $1
            AND i.user_id = $1
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
            ) / NULLIF(SUM(purchase_count), 0) * 100 AS inflation
          FROM product_prices
          WHERE current_avg IS NOT NULL AND previous_avg IS NOT NULL
        )
        SELECT COALESCE(inflation, 0) AS inflation FROM weighted_inflation
      `, [userId])
      return Number(result.rows[0]?.inflation ?? 0)
    },
  }
}
