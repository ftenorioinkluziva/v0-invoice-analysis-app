import { describe, expect, it, vi } from 'vitest'
import {
  importInvoice,
  InvoiceImportConflictError,
  InvoiceImportValidationError,
  type InvoiceImportRepository,
} from '@/lib/invoice-import'

const input = {
  filename: 'nota.pdf',
  data: {
    store_name: 'Mercado Teste',
    store_cnpj: '12.345.678/0001-90',
    store_address: 'Rua Exemplo, 123',
    invoice_number: 'NF-123',
    purchase_date: '2026-04-16',
    total_amount: 8.77,
    items: [{ description: 'Tomate 0,680kg', quantity: 0.68, unit_price: 12.9, total_price: 8.77 }],
  },
}

function createRepository(overrides: Partial<InvoiceImportRepository> = {}): InvoiceImportRepository {
  return {
    upsertStore: vi.fn().mockResolvedValue(100),
    findDuplicateInvoice: vi.fn().mockResolvedValue(null),
    createInvoice: vi.fn().mockResolvedValue(200),
    findOrCreateProduct: vi.fn().mockResolvedValue(301),
    createInvoiceItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('invoice import use case', () => {
  it('orchestrates persistence and keeps normalization in the core', async () => {
    const repository = createRepository()

    const result = await importInvoice(input, repository)

    expect(result).toEqual({ invoiceId: 200, itemCount: 1 })
    expect(repository.upsertStore).toHaveBeenCalledWith({
      name: 'Mercado Teste',
      cnpj: '12.345.678/0001-90',
      address: 'Rua Exemplo, 123',
    })
    expect(repository.createInvoiceItem).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 200,
        productId: 301,
        item: expect.objectContaining({
          normalizedName: 'tomate 0.680kg',
          category: 'Hortifruti',
          unit: '680kg',
          comparablePricing: expect.objectContaining({
            comparable_base_unit: 'kg',
            comparable_unit_price: 12.9,
          }),
        }),
      })
    )
  })

  it('raises a typed conflict before creating a duplicate invoice', async () => {
    const repository = createRepository({ findDuplicateInvoice: vi.fn().mockResolvedValue(55) })

    await expect(importInvoice(input, repository)).rejects.toBeInstanceOf(InvoiceImportConflictError)
    expect(repository.createInvoice).not.toHaveBeenCalled()
    expect(repository.createInvoiceItem).not.toHaveBeenCalled()
  })

  it('rejects malformed payloads before calling the repository', async () => {
    const repository = createRepository()

    await expect(importInvoice({ filename: 'nota.pdf', data: {} }, repository)).rejects.toBeInstanceOf(
      InvoiceImportValidationError
    )
    expect(repository.upsertStore).not.toHaveBeenCalled()
  })
})
