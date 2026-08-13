import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const withUserTransaction = vi.fn(async (_userId: string, operation: (client: unknown) => unknown) =>
  operation(await connect())
)
const connect = vi.fn()

vi.mock('@/lib/auth-session', () => ({
  getSessionUserId,
}))

vi.mock('@/lib/session-sql', () => ({
  withUserTransaction,
}))

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect,
    }
  }),
}))

describe('GET /api/product-groups/[id]/history', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('returns 400 for invalid period_days', async () => {
    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups/3/history?period_days=7'),
      { params: Promise.resolve({ id: '3' }) }
    )

    expect(response.status).toBe(400)
    expect(connect).not.toHaveBeenCalled()
  })

  it('returns group aggregates, members and recent comparable items', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('FROM product_groups') && queryText.includes('WHERE id = $1 AND user_id = $2')) {
        expect(params).toEqual([3, 'user-1'])
        return { rows: [{ id: 3, display_name: 'Leites', base_unit: 'L' }] }
      }

      if (queryText.includes('FROM products p') && queryText.includes('ORDER BY product_label ASC')) {
        return {
          rows: [
            { product_id: 10, product_label: 'Marca Boa leite integral', brand: 'Marca Boa' },
            { product_id: 11, product_label: 'Marca X leite desnatado', brand: 'Marca X' },
          ],
        }
      }

      if (queryText.includes('MIN(ii.comparable_unit_price) AS min_unit_price')) {
        expect(params).toEqual([3, 'user-1', 90])
        return {
          rows: [{ min_unit_price: '5.79', avg_unit_price: '6.21', max_unit_price: '6.99' }],
        }
      }

      if (queryText.includes('ii.id AS invoice_item_id')) {
        return {
          rows: [
            {
              invoice_item_id: 100,
              purchase_date: '2026-04-10',
              comparable_unit_price: '6.29',
              product_id: 10,
              product_label: 'Marca Boa leite integral',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups/3/history?period_days=90'),
      { params: Promise.resolve({ id: '3' }) }
    )

    expect(response.status).toBe(200)
    expect(withUserTransaction).toHaveBeenCalledWith('user-1', expect.any(Function))
    await expect(response.json()).resolves.toEqual({
      id: 3,
      display_name: 'Leites',
      base_unit: 'L',
      members: [
        { product_id: 10, product_label: 'Marca Boa leite integral', brand: 'Marca Boa' },
        { product_id: 11, product_label: 'Marca X leite desnatado', brand: 'Marca X' },
      ],
      aggregates: {
        min_unit_price: 5.79,
        avg_unit_price: 6.21,
        max_unit_price: 6.99,
      },
      recent_items: [
        {
          invoice_item_id: 100,
          purchase_date: '2026-04-10',
          comparable_unit_price: 6.29,
          product_id: 10,
          product_label: 'Marca Boa leite integral',
        },
      ],
    })
  })

  it('returns 404 when comparable group schema is not available yet', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM product_groups') && queryText.includes('WHERE id = $1 AND user_id = $2')) {
        const error = new Error('relation "product_groups" does not exist') as Error & { code: string }
        error.code = '42P01'
        throw error
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups/3/history?period_days=90'),
      { params: Promise.resolve({ id: '3' }) }
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Product group not found',
      code: 'PRODUCT_GROUP_NOT_FOUND',
      category: 'not_found',
      retryable: false,
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
