import type { PoolClient } from 'pg'
import type { InvoiceImportRepository } from '@/lib/invoice-import'

export function createPgInvoiceRepository(
  client: PoolClient,
  userId: string
): InvoiceImportRepository {
  return {
    async upsertStore(input) {
      if (input.cnpj) {
        const result = await client.query(`
          INSERT INTO stores (name, cnpj, address, user_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, cnpj) WHERE cnpj IS NOT NULL
          DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [input.name, input.cnpj, input.address, userId])
        return Number(result.rows[0].id)
      }

      const existing = await client.query(
        'SELECT id FROM stores WHERE name = $1 AND user_id = $2 LIMIT 1',
        [input.name, userId]
      )
      if (existing.rows.length > 0) return Number(existing.rows[0].id)

      const result = await client.query(`
        INSERT INTO stores (name, cnpj, address, user_id)
        VALUES ($1, NULL, $2, $3)
        RETURNING id
      `, [input.name, input.address, userId])
      return Number(result.rows[0].id)
    },

    async findDuplicateInvoice(input) {
      const result = await client.query(`
        SELECT id FROM invoices
        WHERE user_id = $5 AND ((invoice_number IS NOT NULL AND invoice_number = $1)
          OR (store_id = $2 AND purchase_date = $3 AND total_amount = $4))
        LIMIT 1
      `, [input.invoiceNumber, input.storeId, input.purchaseDate, input.totalAmount, userId])
      return result.rows.length > 0 ? Number(result.rows[0].id) : null
    },

    async createInvoice(input) {
      const result = await client.query(`
        INSERT INTO invoices (store_id, invoice_number, purchase_date, total_amount, pdf_filename, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [input.storeId, input.invoiceNumber, input.purchaseDate, input.totalAmount, input.filename, userId])
      return Number(result.rows[0].id)
    },

    async findOrCreateProduct(input) {
      const existing = await client.query(
        'SELECT id FROM products WHERE normalized_name = $1 AND user_id = $2 LIMIT 1',
        [input.normalizedName, userId]
      )
      if (existing.rows.length > 0) return Number(existing.rows[0].id)

      const result = await client.query(`
        INSERT INTO products (normalized_name, category, unit, user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [input.normalizedName, input.category, input.unit, userId])
      return Number(result.rows[0].id)
    },

    async createInvoiceItem(input) {
      const { item } = input
      await client.query(`
        INSERT INTO invoice_items (
          invoice_id, product_id, raw_description, quantity, unit_price, total_price,
          comparable_base_unit, comparable_quantity_base, comparable_unit_price,
          measurement_source, measurement_confidence, user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        input.invoiceId,
        input.productId,
        item.description,
        item.quantity,
        item.unitPrice,
        item.totalPrice,
        item.comparablePricing.comparable_base_unit,
        item.comparablePricing.comparable_quantity_base,
        item.comparablePricing.comparable_unit_price,
        item.comparablePricing.measurement_source,
        item.comparablePricing.measurement_confidence,
        userId,
      ])
    },
  }
}
