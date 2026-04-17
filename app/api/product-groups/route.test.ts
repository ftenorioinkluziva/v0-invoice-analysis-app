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

vi.mock('@neondatabase/serverless', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect,
    }
  }),
}))

describe('POST /api/product-groups', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
  })

  it('creates a comparable product group for the active user', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('INSERT INTO product_groups')) {
        return {
          rows: [{ id: 9, display_name: 'Leites', base_unit: 'L' }],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/product-groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: 'Leites', base_unit: 'L' }),
      })
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      id: 9,
      display_name: 'Leites',
      base_unit: 'L',
    })
    expect(setAppUserId).toHaveBeenCalledWith(client, 'user-1')
  })

  it('returns 409 on scoped uniqueness conflict', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('INSERT INTO product_groups')) {
        const error = new Error('duplicate key') as Error & { code: string }
        error.code = '23505'
        throw error
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/product-groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: 'Leites', base_unit: 'L' }),
      })
    )

    expect(response.status).toBe(409)
  })

  it('returns 401 without session', async () => {
    getSessionUserId.mockResolvedValue(null)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/product-groups', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: 'Leites', base_unit: 'L' }),
      })
    )

    expect(response.status).toBe(401)
    expect(connect).not.toHaveBeenCalled()
  })
})

describe('GET /api/product-groups', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    setAppUserId.mockResolvedValue(undefined)
  })

  it('returns 400 for invalid period_days', async () => {
    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups?view=comparable&period_days=7')
    )

    expect(response.status).toBe(400)
    expect(connect).not.toHaveBeenCalled()
  })

  it('returns comparable groups ordered by display name', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('FROM product_groups pg') && queryText.includes('ORDER BY pg.display_name ASC')) {
        expect(params).toEqual(['user-1', 'leite', '%leite%', 90])
        return {
          rows: [
            {
              id: 3,
              display_name: 'Leites',
              base_unit: 'L',
              min_unit_price: '5.79',
              avg_unit_price: '6.21',
              max_unit_price: '6.99',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups?view=comparable&search=leite&period_days=90')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      groups: [
        {
          id: 3,
          display_name: 'Leites',
          base_unit: 'L',
          min_unit_price: 5.79,
          avg_unit_price: 6.21,
          max_unit_price: 6.99,
        },
      ],
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
