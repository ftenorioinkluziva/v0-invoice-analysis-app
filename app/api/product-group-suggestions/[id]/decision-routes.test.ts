import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const setAppUserId = vi.fn()
const connect = vi.fn()

vi.mock('@/lib/auth-session', () => ({
  getSessionUserId,
}))

vi.mock('@/lib/session-sql', () => ({
  setAppUserId,
}))

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect,
    }
  }),
}))

describe('/api/product-group-suggestions/[id]/accept and /reject', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
  })

  it('accepts a pending suggestion and audits the group association', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM product_group_suggestions') && queryText.includes("status = 'pending'")) {
        return {
          rows: [
            {
              id: 14,
              source_product_id: 7,
              target_group_id: 3,
              confidence: 0.812,
              reasons: ['Unidade base compativel'],
              status: 'pending',
              signals_snapshot: {
                normalized_name: 'cafe pilao 500g',
                category: 'Bebidas',
                comparable_base_unit: 'kg',
                comparable_group_id: null,
                target_group_id: 3,
              },
            },
          ],
        }
      }

      if (queryText.includes('SELECT id, normalized_name, category, brand, comparable_group_id')) {
        return {
          rows: [
            {
              id: 7,
              normalized_name: 'cafe pilao 500g',
              category: 'Bebidas',
              brand: 'Pilao',
              comparable_group_id: null,
            },
          ],
        }
      }

      if (queryText.includes('SELECT id, display_name, base_unit') && queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafes', base_unit: 'kg' }] }
      }

      if (queryText.includes('SELECT ii.comparable_base_unit')) {
        return { rows: [{ comparable_base_unit: 'kg' }] }
      }

      if (queryText.includes('UPDATE products') || queryText.includes('INSERT INTO product_group_membership_events')) {
        return { rows: [] }
      }

      if (queryText.includes('UPDATE product_group_suggestions') && queryText.includes("status = 'accepted'")) {
        return {
          rows: [
            {
              id: 14,
              source_product_id: 7,
              target_group_id: 3,
              confidence: 0.812,
              reasons: ['Unidade base compativel'],
              status: 'accepted',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./accept/route')
    const response = await POST(
      new Request('http://localhost/api/product-group-suggestions/14/accept', { method: 'POST' }),
      { params: Promise.resolve({ id: '14' }) }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 14,
      source_product_id: 7,
      target_group_id: 3,
      confidence: 0.812,
      reasons: ['Unidade base compativel'],
      status: 'accepted',
    })
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO product_group_membership_events'), [7, 3, 'user-1', 'user-1'])
  })

  it('rejects stale suggestions when current comparable evidence changed', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM product_group_suggestions') && queryText.includes("status = 'pending'")) {
        return {
          rows: [
            {
              id: 14,
              source_product_id: 7,
              target_group_id: 3,
              confidence: 0.812,
              reasons: ['Unidade base compativel'],
              status: 'pending',
              signals_snapshot: {
                normalized_name: 'cafe pilao 500g',
                category: 'Bebidas',
                comparable_base_unit: 'kg',
                comparable_group_id: null,
                target_group_id: 3,
              },
            },
          ],
        }
      }

      if (queryText.includes('SELECT id, normalized_name, category, brand, comparable_group_id')) {
        return {
          rows: [
            {
              id: 7,
              normalized_name: 'cafe pilao 500g',
              category: 'Bebidas',
              brand: 'Pilao',
              comparable_group_id: null,
            },
          ],
        }
      }

      if (queryText.includes('SELECT id, display_name, base_unit') && queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafes', base_unit: 'kg' }] }
      }

      if (queryText.includes('SELECT ii.comparable_base_unit')) {
        return { rows: [{ comparable_base_unit: 'L' }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./reject/route')
    const response = await POST(
      new Request('http://localhost/api/product-group-suggestions/14/reject', { method: 'POST' }),
      { params: Promise.resolve({ id: '14' }) }
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: 'Suggestion is obsolete',
      code: 'SUGGESTION_STATE_CONFLICT',
      category: 'conflict',
      retryable: false,
    })
  })

  it('returns 404 when the suggestion does not belong to the active user', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM product_group_suggestions') && queryText.includes("status = 'pending'")) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./accept/route')
    const response = await POST(
      new Request('http://localhost/api/product-group-suggestions/14/accept', { method: 'POST' }),
      { params: Promise.resolve({ id: '14' }) }
    )

    expect(response.status).toBe(404)
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
