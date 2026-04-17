import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const setAppUserId = vi.fn()
const sql = vi.fn()
const connect = vi.fn()

vi.mock('@/lib/auth-session', () => ({
  getSessionUserId,
}))

vi.mock('@/lib/session-sql', () => ({
  setAppUserId,
}))

vi.mock('@/lib/db', () => ({
  sql,
}))

vi.mock('@neondatabase/serverless', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect,
    }
  }),
}))

describe('POST /api/invoices', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
    sql.mockResolvedValue([{ alert_threshold: 15, notify_price_increase: false }])
  })

  async function executePost(items: Array<{ description: string; quantity: number; unit_price: number; total_price: number }>) {
    let nextProductId = 300
    const insertedItemCalls: unknown[][] = []

    const client = {
      query: vi.fn(async (queryText: string, params?: unknown[]) => {
        if (queryText === 'BEGIN' || queryText === 'COMMIT' || queryText === 'ROLLBACK') {
          return { rows: [] }
        }

        if (queryText.includes('INSERT INTO stores')) {
          return { rows: [{ id: 100 }] }
        }

        if (queryText.includes('SELECT id FROM invoices')) {
          return { rows: [] }
        }

        if (queryText.includes('INSERT INTO invoices')) {
          return { rows: [{ id: 200 }] }
        }

        if (queryText.includes('SELECT id FROM products')) {
          return { rows: [] }
        }

        if (queryText.includes('INSERT INTO products')) {
          nextProductId += 1
          return { rows: [{ id: nextProductId }] }
        }

        if (queryText.includes('INSERT INTO invoice_items')) {
          insertedItemCalls.push(params ?? [])
          return { rows: [] }
        }

        throw new Error(`Unexpected query: ${queryText}`)
      }),
      release: vi.fn(),
    }

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(new Request('http://localhost/api/invoices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'nota.pdf',
        data: {
          store_name: 'Mercado Teste',
          store_cnpj: '12.345.678/0001-90',
          store_address: 'Rua Exemplo, 123',
          invoice_number: 'NF-123',
          purchase_date: '2026-04-16',
          total_amount: items.reduce((sum, item) => sum + item.total_price, 0),
          items,
        },
      }),
    }))

    return {
      response,
      insertedItemCalls,
    }
  }

  it('persists scale items with canonical comparable price', async () => {
    const { response, insertedItemCalls } = await executePost([
      { description: 'Tomate 0,680kg', quantity: 0.68, unit_price: 12.9, total_price: 8.77 },
    ])

    expect(response.status).toBe(200)
    expect(insertedItemCalls).toHaveLength(1)
    expect(insertedItemCalls[0]).toEqual([
      200,
      301,
      'Tomate 0,680kg',
      0.68,
      12.9,
      8.77,
      'kg',
      1,
      12.9,
      'scale_item',
      1,
      'user-1',
    ])
  })

  it('uses line quantity for identical packaged items', async () => {
    const { response, insertedItemCalls } = await executePost([
      { description: 'Leite integral 1L', quantity: 2, unit_price: 6.49, total_price: 12.98 },
    ])

    expect(response.status).toBe(200)
    expect(insertedItemCalls[0]).toEqual([
      200,
      301,
      'Leite integral 1L',
      2,
      6.49,
      12.98,
      'L',
      1,
      6.49,
      'description',
      0.95,
      'user-1',
    ])
  })

  it('keeps non-comparable fields null while preserving audit metadata', async () => {
    const { response, insertedItemCalls } = await executePost([
      { description: 'Biscoito cream cracker', quantity: 1, unit_price: 4.99, total_price: 4.99 },
    ])

    expect(response.status).toBe(200)
    expect(insertedItemCalls[0]).toEqual([
      200,
      301,
      'Biscoito cream cracker',
      1,
      4.99,
      4.99,
      null,
      null,
      null,
      'description',
      0,
      'user-1',
    ])
  })
})
