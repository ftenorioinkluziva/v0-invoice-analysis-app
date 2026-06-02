import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const generateText = vi.fn()

vi.mock('@/lib/auth-session', () => ({
  getSessionUserId,
}))

vi.mock('ai', () => ({
  generateText,
  Output: {
    object: vi.fn((input) => input),
  },
}))

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((model: string) => model),
}))

const createUploadRequest = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  return new Request('http://localhost/api/extract-pdf', {
    method: 'POST',
    body: formData,
  })
}

describe('POST /api/extract-pdf', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    generateText.mockResolvedValue({
      output: {
        store_name: 'Mercado Teste',
        store_cnpj: null,
        store_address: null,
        invoice_number: null,
        purchase_date: '2026-06-02',
        total_amount: 10,
        items: [{ description: 'Arroz', quantity: 1, unit_price: 10, total_price: 10 }],
      },
    })
  })

  it('requires an authenticated session before processing uploads', async () => {
    getSessionUserId.mockResolvedValue(null)
    const { POST } = await import('./route')

    const response = await POST(
      createUploadRequest(new File(['pdf'], 'nota.pdf', { type: 'application/pdf' }))
    )

    expect(response.status).toBe(401)
    expect(generateText).not.toHaveBeenCalled()
  })

  it('rejects unsupported file formats before calling AI extraction', async () => {
    const { POST } = await import('./route')

    const response = await POST(
      createUploadRequest(new File(['texto'], 'nota.txt', { type: 'text/plain' }))
    )
    const body = await response.json()

    expect(response.status).toBe(415)
    expect(body).toMatchObject({
      code: 'UNSUPPORTED_FILE_TYPE',
      error: 'Formato não aceito. Envie PDF, JPG, PNG ou WEBP.',
    })
    expect(generateText).not.toHaveBeenCalled()
  })

  it('rejects files larger than the upload limit before calling AI extraction', async () => {
    const { POST, MAX_UPLOAD_BYTES } = await import('./route')
    const oversizedFile = new File(
      [new Uint8Array(MAX_UPLOAD_BYTES + 1)],
      'nota-grande.pdf',
      { type: 'application/pdf' }
    )

    const response = await POST(createUploadRequest(oversizedFile))
    const body = await response.json()

    expect(response.status).toBe(413)
    expect(body).toMatchObject({
      code: 'FILE_TOO_LARGE',
      error: 'Arquivo muito grande. Envie uma nota de até 10 MB.',
    })
    expect(generateText).not.toHaveBeenCalled()
  })
})
