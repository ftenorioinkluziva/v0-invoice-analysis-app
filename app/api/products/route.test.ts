import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const setAppUserId = vi.fn()
const withUserTransaction = vi.fn(async (_userId: string, operation: (client: unknown) => unknown) =>
  operation(await connect())
)
const connect = vi.fn()

vi.mock('@/lib/auth-session', () => ({
  getSessionUserId,
}))

vi.mock('@/lib/session-sql', () => ({
  setAppUserId,
  withUserTransaction,
}))

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect,
    }
  }),
}))

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
  })

  it('returns 400 for invalid period_days', async () => {
    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/products?period_days=7'))

    expect(response.status).toBe(400)
    expect(connect).not.toHaveBeenCalled()
  })

  it('returns filtered products for the requested period', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('HAVING COUNT(ii.id) FILTER')) {
        expect(params).toEqual(['user-1', 'leite', ['%leite%'], 30, ''])
        expect(queryText).toContain('p.normalized_name ILIKE ALL($3::text[])')
        return {
          rows: [
            {
              products: [
                {
                  id: 11,
                  normalized_name: 'leite integral',
                  category: 'Laticinios',
                  avg_price: '6.49',
                  purchase_count: '4',
                  last_purchase: '2026-04-10',
                },
              ],
              categories: ['Laticinios'],
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/products?search=leite&period_days=30'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      products: [
        {
          id: 11,
          normalized_name: 'leite integral',
          category: 'Laticinios',
          avg_price: 6.49,
          purchase_count: 4,
          last_purchase: '2026-04-10',
        },
      ],
      categories: ['Laticinios'],
    })
  })

  it('preserves broad product search when period_days is omitted', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('HAVING COUNT(ii.id) FILTER')) {
        expect(params).toEqual(['user-1', 'arroz', ['%arroz%'], null, ''])
        expect(queryText).toContain('WHERE $4::int IS NULL OR i.purchase_date >= CURRENT_DATE - ($4::int * INTERVAL \'1 day\')')

        return {
          rows: [
            {
              products: [
                {
                  id: 21,
                  normalized_name: 'arroz integral',
                  category: 'Mercearia',
                  avg_price: '24.90',
                  purchase_count: '2',
                  last_purchase: '2025-12-01',
                },
              ],
              categories: ['Mercearia'],
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/products?search=arroz'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      products: [
        {
          id: 21,
          normalized_name: 'arroz integral',
          category: 'Mercearia',
          avg_price: 24.9,
          purchase_count: 2,
          last_purchase: '2025-12-01',
        },
      ],
      categories: ['Mercearia'],
    })
  })

  it('requires every search word without requiring an exact phrase', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('HAVING COUNT(ii.id) FILTER')) {
        expect(params).toEqual(['user-1', 'arroz branco', ['%arroz%', '%branco%'], null, ''])
        expect(queryText).toContain('p.normalized_name ILIKE ALL($3::text[])')
        return {
          rows: [{
            products: [{
              id: 31,
              normalized_name: 'arroz tio joao branco 2kg',
              category: 'Grãos',
              avg_price: '13.08',
              purchase_count: '7',
              last_purchase: '2026-08-01',
            }],
            categories: ['Grãos'],
          }],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/products?search=arroz%20branco'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      products: [{ normalized_name: 'arroz tio joao branco 2kg' }],
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
