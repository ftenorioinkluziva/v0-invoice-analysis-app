import { sqlForClient } from '@/lib/db'
import { SaveInvoiceSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgInvoiceRepository } from '@/lib/invoice-repository'
import { importInvoice, InvoiceImportConflictError } from '@/lib/invoice-import'
import { generatePriceAlerts } from '@/lib/price-alerts'
import { createPgPriceAlertRepository } from '@/lib/price-alert-repository'

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

    await withUserTransaction(userId, async client => {
      await generatePriceAlerts(
        parsed.data.data.items,
        createPgPriceAlertRepository(client, userId),
        { sourceInvoiceId: result.invoiceId }
      )
    })

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
