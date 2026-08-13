import { SaveInvoiceSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgInvoiceRepository } from '@/lib/invoice-repository'
import { createPgInvoiceListRepository } from '@/lib/invoice-list-repository'
import { listInvoices } from '@/lib/invoice-list'
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
      return listInvoices(createPgInvoiceListRepository(client, userId))
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
      const imported = await importInvoice(parsed.data, repository)
      await generatePriceAlerts(
        parsed.data.data.items,
        createPgPriceAlertRepository(client, userId),
        { sourceInvoiceId: imported.invoiceId }
      )

      return imported
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
