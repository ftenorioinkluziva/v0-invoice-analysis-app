import { sqlForClient } from '@/lib/db'
import type { ExtractedInvoice } from '@/lib/types'
import { SaveInvoiceSchema } from '@/lib/validations'
import { normalizeProductName } from '@/lib/invoice-utils'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgInvoiceRepository } from '@/lib/invoice-repository'
import { importInvoice, InvoiceImportConflictError } from '@/lib/invoice-import'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoices = await withUserTransaction(userId, async (client) => {
      const sql = sqlForClient(client)
      return sql`
      SELECT 
        i.id,
        i.invoice_number,
        i.purchase_date,
        i.total_amount,
        i.pdf_filename,
        i.processed_at,
        s.name as store_name,
        s.cnpj as store_cnpj,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id AND user_id = ${userId}) as item_count
      FROM invoices i
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE i.user_id = ${userId}
      ORDER BY i.purchase_date DESC
      LIMIT 50
    `
    })
    return Response.json({ invoices })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return Response.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = SaveInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const result = await withUserTransaction(userId, async client => {
      const repository = createPgInvoiceRepository(client, userId)
      return importInvoice(parsed.data, repository)
    })

    await generatePriceAlerts(parsed.data.data.items, userId)

    return Response.json({
      success: true,
      invoiceId: result.invoiceId,
      message: `Invoice saved with ${result.itemCount} items`,
    })
  } catch (error) {
    if (error instanceof InvoiceImportConflictError) {
      return Response.json(
        { error: error.message, duplicateInvoiceId: error.duplicateInvoiceId },
        { status: 409 }
      )
    }

    console.error('Error saving invoice:', error)
    return Response.json({ error: 'Failed to save invoice' }, { status: 500 })
  }
}


async function generatePriceAlerts(items: ExtractedInvoice['items'], userId: string) {
  await withUserTransaction(userId, async (client) => {
  const sql = sqlForClient(client)
  // Obter configurações de notificação dinamicamente
  const prefsConf = await sql`SELECT alert_threshold, notify_price_increase FROM user_preferences WHERE user_id = ${userId} LIMIT 1`
  const threshold = prefsConf.length > 0 ? Number(prefsConf[0].alert_threshold) : 15
  const notifyPriceIncrease = prefsConf.length > 0 ? prefsConf[0].notify_price_increase : true

  if (!notifyPriceIncrease) return;

  for (const item of items) {
    const normalizedName = normalizeProductName(item.description)
    
    // Get historical prices for this product
    const history = await sql`
      SELECT ii.unit_price, i.purchase_date
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE p.normalized_name = ${normalizedName} AND p.user_id = ${userId} AND ii.user_id = ${userId} AND i.user_id = ${userId}
      ORDER BY i.purchase_date DESC
      LIMIT 5
    `

    if (history.length >= 2) {
      const previousPrice = Number(history[1].unit_price)
      const currentPrice = item.unit_price
      const variation = ((currentPrice - previousPrice) / previousPrice) * 100

      if (variation > threshold) {
        const productResult = await sql`
          SELECT id FROM products WHERE normalized_name = ${normalizedName} AND user_id = ${userId} LIMIT 1
        `
        
        if (productResult.length > 0) {
          await sql`
            INSERT INTO alerts (product_id, alert_type, message, data, user_id)
            VALUES (
              ${productResult[0].id}, 
              'price_increase',
              ${`${item.description} aumentou ${variation.toFixed(1)}%`},
              ${JSON.stringify({ previous_price: previousPrice, current_price: currentPrice, variation })},
              ${userId}
            )
          `
        }
      }
    }
  }
  })
}
