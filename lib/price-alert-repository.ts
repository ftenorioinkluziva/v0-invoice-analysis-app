import type { PoolClient } from 'pg'
import type { PriceAlertRepository } from '@/lib/price-alerts'

export function createPgPriceAlertRepository(
  client: PoolClient,
  userId: string
): PriceAlertRepository {
  return {
    async getPreferences() {
      const result = await client.query(
        'SELECT alert_threshold, notify_price_increase FROM user_preferences WHERE user_id = $1 LIMIT 1',
        [userId]
      )
      const row = result.rows[0]
      return {
        threshold: row ? Number(row.alert_threshold) : 15,
        notifyPriceIncrease: row ? Boolean(row.notify_price_increase) : true,
      }
    },

    async getPriceHistory(normalizedName) {
      const result = await client.query(`
        SELECT ii.unit_price, i.purchase_date
        FROM invoice_items ii
        JOIN products p ON ii.product_id = p.id
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE p.normalized_name = $1
          AND p.user_id = $2
          AND ii.user_id = $2
          AND i.user_id = $2
        ORDER BY i.purchase_date DESC
        LIMIT 5
      `, [normalizedName, userId])
      return result.rows.map(row => ({
        unitPrice: Number(row.unit_price),
        purchaseDate: row.purchase_date,
      }))
    },

    async findProductId(normalizedName) {
      const result = await client.query(
        'SELECT id FROM products WHERE normalized_name = $1 AND user_id = $2 LIMIT 1',
        [normalizedName, userId]
      )
      return result.rows.length > 0 ? Number(result.rows[0].id) : null
    },

    async createPriceIncreaseAlert(alert) {
      await client.query(`
        INSERT INTO alerts (product_id, alert_type, message, data, user_id)
        VALUES ($1, 'price_increase', $2, $3, $4)
      `, [alert.productId, alert.message, JSON.stringify(alert.data), userId])
    },
  }
}
