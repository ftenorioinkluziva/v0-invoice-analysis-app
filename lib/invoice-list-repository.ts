import type { PoolClient } from 'pg'
import type { InvoiceListItem, InvoiceListRepository } from '@/lib/invoice-list'

export function createPgInvoiceListRepository(
  client: PoolClient,
  userId: string
): InvoiceListRepository {
  return {
    async listRecent(limit) {
      const result = await client.query(`
        SELECT
          i.id,
          i.invoice_number,
          i.purchase_date,
          i.total_amount,
          i.pdf_filename,
          i.processed_at,
          s.name AS store_name,
          s.cnpj AS store_cnpj,
          (
            SELECT COUNT(*)
            FROM invoice_items
            WHERE invoice_id = i.id AND user_id = $1
          ) AS item_count
        FROM invoices i
        LEFT JOIN stores s ON i.store_id = s.id
        WHERE i.user_id = $1
        ORDER BY i.purchase_date DESC
        LIMIT $2
      `, [userId, limit])

      return result.rows as InvoiceListItem[]
    },
  }
}
