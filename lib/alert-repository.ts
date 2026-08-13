import type { PoolClient } from 'pg'
import type { AlertRepository, AlertListItem } from '@/lib/alerts'

export function createPgAlertRepository(
  client: PoolClient,
  userId: string
): AlertRepository {
  return {
    async listRecent(limit) {
      const result = await client.query(`
        SELECT
          a.id,
          a.alert_type,
          a.message,
          a.data,
          a.read,
          a.created_at,
          p.normalized_name AS product_name,
          p.category
        FROM alerts a
        JOIN products p ON a.product_id = p.id
        WHERE a.user_id = $1 AND p.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2
      `, [userId, limit])

      return result.rows as AlertListItem[]
    },

    async updateRead(input) {
      await client.query(
        'UPDATE alerts SET read = $1 WHERE id = $2 AND user_id = $3',
        [input.read, input.id, userId]
      )
    },
  }
}
