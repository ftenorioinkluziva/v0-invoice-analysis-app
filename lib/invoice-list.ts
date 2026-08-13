export type InvoiceListItem = {
  id: number
  invoice_number: string | null
  purchase_date: string | Date
  total_amount: number | string
  pdf_filename: string | null
  processed_at: string | Date
  store_name: string | null
  store_cnpj: string | null
  item_count: number | string
}

export interface InvoiceListRepository {
  listRecent(limit: number): Promise<InvoiceListItem[]>
}

export async function listInvoices(
  repository: InvoiceListRepository,
  options: { limit?: number } = {}
): Promise<InvoiceListItem[]> {
  const requestedLimit = options.limit ?? 50
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50

  return repository.listRecent(limit)
}
