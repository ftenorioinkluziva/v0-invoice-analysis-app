import type { PoolClient } from 'pg'
import type { UserDataDeletionRepository } from '@/lib/data-deletion'

export function createPgUserDataDeletionRepository(
  client: PoolClient,
  userId: string
): UserDataDeletionRepository {
  return {
    async deleteAllForUser() {
      // Delete dependents first. All predicates remain tenant-scoped even with RLS.
      await client.query('DELETE FROM product_group_membership_events WHERE user_id = $1', [userId])
      await client.query('DELETE FROM product_group_suggestions WHERE user_id = $1', [userId])
      await client.query('DELETE FROM alerts WHERE user_id = $1', [userId])
      await client.query('DELETE FROM invoice_items WHERE user_id = $1', [userId])
      await client.query('DELETE FROM shopping_list_items WHERE user_id = $1', [userId])
      await client.query('DELETE FROM invoices WHERE user_id = $1', [userId])
      await client.query('DELETE FROM shopping_lists WHERE user_id = $1', [userId])
      await client.query('DELETE FROM products WHERE user_id = $1', [userId])
      await client.query('DELETE FROM product_groups WHERE user_id = $1', [userId])
      await client.query('DELETE FROM stores WHERE user_id = $1', [userId])
      await client.query('DELETE FROM user_preferences WHERE user_id = $1', [userId])
    },
  }
}
