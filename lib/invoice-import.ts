import { SaveInvoiceSchema } from '@/lib/validations'
import {
  buildComparablePricing,
  categorizeProduct,
  extractUnit,
  normalizeProductName,
  validateItemPrices,
} from '@/lib/invoice-utils'
import type { ComparablePricing } from '@/lib/types'

export type InvoiceImportInput = {
  data: {
    store_name: string
    store_cnpj: string | null
    store_address: string | null
    invoice_number: string | null
    purchase_date: string
    items: Array<{
      description: string
      quantity: number
      unit_price: number
      total_price: number
    }>
    total_amount: number
  }
  filename: string
}

export type InvoiceItemPersistence = {
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
  normalizedName: string
  category: string
  unit: string | null
  comparablePricing: ComparablePricing
}

export interface InvoiceImportRepository {
  upsertStore(input: {
    name: string
    cnpj: string | null
    address: string | null
  }): Promise<number>
  findDuplicateInvoice(input: {
    invoiceNumber: string | null
    storeId: number
    purchaseDate: string
    totalAmount: number
  }): Promise<number | null>
  createInvoice(input: {
    storeId: number
    invoiceNumber: string | null
    purchaseDate: string
    totalAmount: number
    filename: string
  }): Promise<number>
  findOrCreateProduct(input: {
    normalizedName: string
    category: string
    unit: string | null
  }): Promise<number>
  createInvoiceItem(input: {
    invoiceId: number
    productId: number
    item: InvoiceItemPersistence
  }): Promise<void>
}

export class InvoiceImportConflictError extends Error {
  readonly code = 'INVOICE_ALREADY_IMPORTED'
  readonly duplicateInvoiceId: number

  constructor(duplicateInvoiceId: number) {
    super('Nota fiscal já importada')
    this.name = 'InvoiceImportConflictError'
    this.duplicateInvoiceId = duplicateInvoiceId
  }
}

export class InvoiceImportValidationError extends Error {
  readonly code = 'INVALID_INVOICE_IMPORT'
  readonly invalidFields: string[]

  constructor(invalidFields: string[]) {
    super('Invalid invoice import payload')
    this.name = 'InvoiceImportValidationError'
    this.invalidFields = invalidFields
  }
}

export async function importInvoice(
  input: unknown,
  repository: InvoiceImportRepository
): Promise<{ invoiceId: number; itemCount: number }> {
  const parsed = SaveInvoiceSchema.safeParse(input)
  if (!parsed.success) {
    throw new InvoiceImportValidationError(
      parsed.error.issues.map(issue => issue.path.join('.'))
    )
  }

  const { data, filename } = parsed.data
  const storeId = await repository.upsertStore({
    name: data.store_name,
    cnpj: data.store_cnpj,
    address: data.store_address,
  })

  const duplicateInvoiceId = await repository.findDuplicateInvoice({
    invoiceNumber: data.invoice_number,
    storeId,
    purchaseDate: data.purchase_date,
    totalAmount: data.total_amount,
  })

  if (duplicateInvoiceId !== null) {
    throw new InvoiceImportConflictError(duplicateInvoiceId)
  }

  const invoiceId = await repository.createInvoice({
    storeId,
    invoiceNumber: data.invoice_number,
    purchaseDate: data.purchase_date,
    totalAmount: data.total_amount,
    filename,
  })

  for (const sourceItem of data.items) {
    const validated = validateItemPrices(sourceItem)
    const item: InvoiceItemPersistence = {
      description: validated.description,
      quantity: validated.quantity,
      unitPrice: validated.unit_price,
      totalPrice: validated.total_price,
      normalizedName: normalizeProductName(validated.description),
      category: categorizeProduct(validated.description),
      unit: extractUnit(validated.description),
      comparablePricing: buildComparablePricing(validated),
    }
    const productId = await repository.findOrCreateProduct({
      normalizedName: item.normalizedName,
      category: item.category,
      unit: item.unit,
    })

    await repository.createInvoiceItem({ invoiceId, productId, item })
  }

  return { invoiceId, itemCount: data.items.length }
}
