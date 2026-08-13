import { SaveInvoiceSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgInvoiceRepository } from '@/lib/invoice-repository'
import { createPgInvoiceListRepository } from '@/lib/invoice-list-repository'
import { listInvoices } from '@/lib/invoice-list'
import { importInvoice, InvoiceImportConflictError } from '@/lib/invoice-import'
import { generatePriceAlerts } from '@/lib/price-alerts'
import { createPgPriceAlertRepository } from '@/lib/price-alert-repository'
import {
  operationErrorResponse,
  toOperationError,
  unauthorizedError,
  validationError,
} from '@/lib/operation-error'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const invoices = await withUserTransaction(userId, async (client) => {
      return listInvoices(createPgInvoiceListRepository(client, userId))
    })
    return Response.json({ invoices })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'INVOICE_LIST_FAILED',
      message: 'Failed to fetch invoices',
    }))
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const parsed = SaveInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_INVOICE_REQUEST',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
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
      return operationErrorResponse(error, {
        extra: { duplicateInvoiceId: error.duplicateInvoiceId },
      })
    }

    console.error('Error saving invoice:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'INVOICE_IMPORT_FAILED',
      message: 'Failed to save invoice',
    }))
  }
}
