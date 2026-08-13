import { beforeEach, describe, expect, it, vi } from 'vitest'

const { generateText, createOpenRouter } = vi.hoisted(() => ({
  generateText: vi.fn(),
  createOpenRouter: vi.fn(() => vi.fn((model: string) => model)),
}))

vi.mock('ai', () => ({
  generateText,
  Output: { object: vi.fn((input) => input) },
}))

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter,
}))

import {
  createInvoiceExtractor,
  INVOICE_EXTRACTION_MODEL,
} from '@/lib/ai/invoice-extractor'

describe('OpenRouter invoice extraction adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    generateText.mockResolvedValue({ output: { store_name: 'Mercado Teste' } })
  })

  it('uses the configured OpenRouter key and canonical Gemini model id', async () => {
    const extractor = createInvoiceExtractor({ apiKey: 'test-key' })

    await extractor.extract({
      data: 'base64-pdf',
      mediaType: 'application/pdf',
      filename: 'nota.pdf',
    })

    expect(createOpenRouter).toHaveBeenCalledWith({ apiKey: 'test-key' })
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: INVOICE_EXTRACTION_MODEL })
    )
  })

  it('fails explicitly when the provider key is missing', async () => {
    const extractor = createInvoiceExtractor({ apiKey: '' })

    await expect(
      extractor.extract({ data: 'base64-pdf', mediaType: 'application/pdf', filename: 'nota.pdf' })
    ).rejects.toMatchObject({ details: { code: 'AI_CONFIG_MISSING', retryable: false } })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('marks provider rate limits as retryable', async () => {
    const upstreamError = Object.assign(new Error('rate limited'), { statusCode: 429 })
    generateText.mockRejectedValue(upstreamError)

    await expect(
      createInvoiceExtractor({ apiKey: 'test-key' }).extract({
        data: 'base64-pdf',
        mediaType: 'application/pdf',
        filename: 'nota.pdf',
      })
    ).rejects.toMatchObject({ details: { code: 'AI_RATE_LIMIT', retryable: true } })
  })
})
