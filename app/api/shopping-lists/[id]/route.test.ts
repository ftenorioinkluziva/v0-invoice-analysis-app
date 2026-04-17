import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const setAppUserId = vi.fn()
const connect = vi.fn()
const sql = vi.fn()

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

describe('GET /api/shopping-lists/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
  })

  it('returns comparable metadata and preserves nullable prices', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('list_check AS') && queryText.includes('list_items AS')) {
        expect(params).toEqual([12, 'user-1', 90])
        return {
          rows: [
            {
              list: { id: 12, name: 'Mercado', status: 'active', created_at: '2026-04-16' },
              items: [
                {
                  id: 101,
                  quantity: 2,
                  checked: false,
                  estimated_price: null,
                  product_id: 7,
                  normalized_name: 'leite integral',
                  category: 'Laticinios',
                  last_price: null,
                  price_variation: null,
                  comparable_unit_price: '6.21',
                  comparable_base_unit: 'L',
                  comparable_group_name: 'Leites',
                },
                {
                  id: 102,
                  quantity: 1,
                  checked: true,
                  estimated_price: '8.90',
                  product_id: 8,
                  normalized_name: 'cafe especial',
                  category: 'Mercearia',
                  last_price: null,
                  price_variation: '0',
                  comparable_unit_price: null,
                  comparable_base_unit: null,
                  comparable_group_name: null,
                },
              ],
              suggestions: [],
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/shopping-lists/12'), {
      params: Promise.resolve({ id: '12' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      list: { id: 12, name: 'Mercado', status: 'active', created_at: '2026-04-16' },
      items: [
        {
          id: 101,
          quantity: 2,
          checked: false,
          estimated_price: null,
          product_id: 7,
          normalized_name: 'leite integral',
          category: 'Laticinios',
          last_price: null,
          previous_price: null,
          price_variation: 0,
          comparable_unit_price: 6.21,
          comparable_base_unit: 'L',
          comparable_reference_label: 'Referencia em R$/L',
          comparable_group_name: 'Leites',
        },
        {
          id: 102,
          quantity: 1,
          checked: true,
          estimated_price: 8.9,
          product_id: 8,
          normalized_name: 'cafe especial',
          category: 'Mercearia',
          last_price: null,
          previous_price: null,
          price_variation: 0,
          comparable_unit_price: null,
          comparable_base_unit: null,
          comparable_reference_label: null,
          comparable_group_name: null,
        },
      ],
      suggestions: [],
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
