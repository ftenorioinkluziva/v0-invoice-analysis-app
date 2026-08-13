import { describe, expect, it, vi } from 'vitest'
import {
  extractInvoice,
  InvoiceExtractionOperationError,
} from '@/lib/invoice-extraction'

const validInput = {
  data: 'base64-pdf',
  mediaType: 'application/pdf' as const,
  filename: 'nota.pdf',
}

const validInvoice = {
  store_name: 'Mercado Teste',
  store_cnpj: null,
  store_address: null,
  invoice_number: null,
  purchase_date: '2026-06-02',
  total_amount: 10,
  items: [{ description: 'Arroz', quantity: 1, unit_price: 10, total_price: 10 }],
}

describe('invoice extraction core contract', () => {
  it('rejects malformed input before calling the provider', async () => {
    const extract = vi.fn()

    const result = await extractInvoice({ ...validInput, data: '' }, { extract })

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_EXTRACTION_INPUT' } })
    expect(extract).not.toHaveBeenCalled()
  })

  it('validates the provider output at the core boundary', async () => {
    const result = await extractInvoice(validInput, {
      extract: vi.fn().mockResolvedValue({ store_name: 'incompleto' }),
    })

    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_EXTRACTION_OUTPUT' } })
  })

  it('returns the canonical invoice when the provider succeeds', async () => {
    const result = await extractInvoice(validInput, {
      extract: vi.fn().mockResolvedValue(validInvoice),
    })

    expect(result).toEqual({ ok: true, value: validInvoice })
  })

  it('preserves typed provider errors and their retry policy', async () => {
    const result = await extractInvoice(validInput, {
      extract: vi.fn().mockRejectedValue(
        new InvoiceExtractionOperationError({
          code: 'AI_RATE_LIMIT',
          category: 'rate_limit',
          message: 'rate limited',
          retryable: true,
        })
      ),
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'AI_RATE_LIMIT',
        category: 'rate_limit',
        message: 'rate limited',
        retryable: true,
      },
    })
  })
})
