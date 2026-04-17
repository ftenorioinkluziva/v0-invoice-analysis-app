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

describe('PATCH /api/products/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
    sql.mockResolvedValue([])
  })

  it('updates the product brand without touching raw history', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('UPDATE products')) {
        expect(params).toEqual(['Marca Boa', 12, 'user-1'])
        return { rows: [{ id: 12, brand: 'Marca Boa' }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { PATCH } = await import('./route')
    const response = await PATCH(
      new Request('http://localhost/api/products/12', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brand: 'Marca Boa' }),
      }),
      { params: Promise.resolve({ id: '12' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 12, brand: 'Marca Boa' })
  })

  it('returns 400 for invalid payloads', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(
      new Request('http://localhost/api/products/12', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ normalized_name: 'nao pode' }),
      }),
      { params: Promise.resolve({ id: '12' }) }
    )

    expect(response.status).toBe(400)
    expect(connect).not.toHaveBeenCalled()
  })
})

describe('GET /api/products/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
  })

  it('returns 400 for invalid period_days', async () => {
    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/products/12?period_days=7'),
      { params: Promise.resolve({ id: '12' }) }
    )

    expect(response.status).toBe(400)
    expect(connect).not.toHaveBeenCalled()
  })

  it('returns history scoped to the requested period', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('FROM products') && queryText.includes('WHERE id = $1 AND user_id = $2')) {
        expect(params).toEqual([12, 'user-1'])
        return { rows: [{ id: 12, normalized_name: 'leite integral', category: 'Laticinios' }] }
      }

      if (queryText.includes('FROM invoice_items ii') && queryText.includes('LIMIT 20')) {
        expect(params).toEqual([12, 'user-1', 30])
        return {
          rows: [
            {
              price: '6.89',
              raw_description: 'Leite Integral 1L',
              date: '2026-04-10',
              store_name: 'Mercado Bom',
            },
          ],
        }
      }

      if (queryText.includes('AVG(ii.unit_price) AS avg_price')) {
        return { rows: [{ avg_price: '6.49', min_price: '5.99', max_price: '6.89' }] }
      }

      if (queryText.includes('WITH filtered_prices AS')) {
        return { rows: [{ variation: '15.2' }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/products/12?period_days=30'),
      { params: Promise.resolve({ id: '12' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      product_id: 12,
      product_name: 'leite integral',
      category: 'Laticinios',
      prices: [
        {
          date: '2026-04-10',
          price: 6.89,
          store_name: 'Mercado Bom',
          raw_description: 'Leite Integral 1L',
        },
      ],
      stats: {
        avg_price: 6.49,
        min_price: 5.99,
        max_price: 6.89,
        price_variation_6m: 15.2,
      },
    })
  })
})

function createClient(handler: (queryText: string, params?: unknown[]) => Promise<{ rows: unknown[] }>) {
  return {
    query: vi.fn(async (queryText: string, params?: unknown[]) => {
      if (queryText === 'BEGIN' || queryText === 'COMMIT' || queryText === 'ROLLBACK') {
        return { rows: [] }
      }

      return handler(queryText, params)
    }),
    release: vi.fn(),
  }
}
