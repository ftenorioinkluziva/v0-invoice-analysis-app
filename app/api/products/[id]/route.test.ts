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
        return { rows: [{ id: 12, brand: 'Marca Boa', units_per_pack: null }] }
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
    await expect(response.json()).resolves.toEqual({ id: 12, brand: 'Marca Boa', units_per_pack: null })
  })

  it('updates units_per_pack independently of brand', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('UPDATE products')) {
        expect(params).toEqual([10, 12, 'user-1'])
        return { rows: [{ id: 12, brand: null, units_per_pack: 10 }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { PATCH } = await import('./route')
    const response = await PATCH(
      new Request('http://localhost/api/products/12', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ units_per_pack: 10 }),
      }),
      { params: Promise.resolve({ id: '12' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: 12, brand: null, units_per_pack: 10 })
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
      if (queryText.includes('product_row AS') && queryText.includes('price_history AS')) {
        expect(params).toEqual([12, 'user-1', 30])
        return {
          rows: [
            {
              product: {
                id: 12,
                normalized_name: 'leite integral',
                category: 'Laticinios',
                brand: 'Marca Boa',
                units_per_pack: null,
                comparable_base_unit: 'L',
                comparable_group_id: 7,
                comparable_group_display_name: 'Leites',
                comparable_group_base_unit: 'L',
              },
              prices: [
                {
                  price: '6.89',
                  raw_description: 'Leite Integral 1L',
                  date: '2026-04-10',
                  store_name: 'Mercado Bom',
                },
              ],
              stats: {
                avg_price: '6.49',
                min_price: '5.99',
                max_price: '6.89',
                variation: '15.2',
              },
            },
          ],
        }
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
      brand: 'Marca Boa',
      units_per_pack: null,
      comparable_base_unit: 'L',
      comparable_group: {
        id: 7,
        display_name: 'Leites',
        base_unit: 'L',
      },
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
