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
              comparable_occurrences: '4',
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
          comparable_occurrences: 4,
          min_unit_price: 5.79,
          avg_unit_price: 6.21,
          max_unit_price: 6.99,
        },
      ],
    })
  })

  it('returns groups with zeroed metrics when they have no comparable occurrences in the selected period', async () => {
    const client = createClient(async (queryText, params) => {
      if (
        queryText.includes('LEFT JOIN invoice_items ii')
        && queryText.includes('MIN(CASE WHEN i.id IS NOT NULL THEN ii.comparable_unit_price END)')
      ) {
        expect(params).toEqual(['user-1', 'creme', '%creme%', 90])
        return {
          rows: [
            {
              id: 14,
              display_name: 'creme leite',
              base_unit: 'kg',
              min_unit_price: null,
              avg_unit_price: null,
              max_unit_price: null,
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups?view=comparable&search=creme&period_days=90')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      groups: [
        {
          id: 14,
          display_name: 'creme leite',
          base_unit: 'kg',
          comparable_occurrences: 0,
          min_unit_price: 0,
          avg_unit_price: 0,
          max_unit_price: 0,
        },
      ],
    })
  })

  it('matches comparable groups when the search term is in a member product name or brand', async () => {
    const client = createClient(async (queryText, params) => {
      if (
        queryText.includes('FROM product_groups pg')
        && queryText.includes('search_products.normalized_name ILIKE $3')
        && queryText.includes('COALESCE(search_products.brand, \'\') ILIKE $3')
      ) {
        expect(params).toEqual(['user-1', 'pilao', '%pilao%', 90])
        return {
          rows: [
            {
              id: 8,
              display_name: 'Cafes',
              base_unit: 'kg',
              comparable_occurrences: '3',
              min_unit_price: '31.90',
              avg_unit_price: '34.10',
              max_unit_price: '35.99',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups?view=comparable&search=pilao&period_days=90')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      groups: [
        {
          id: 8,
          display_name: 'Cafes',
          base_unit: 'kg',
          comparable_occurrences: 3,
          min_unit_price: 31.9,
          avg_unit_price: 34.1,
          max_unit_price: 35.99,
        },
      ],
    })
  })

  it('returns all groups for manual association, including newly created ones', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('FROM product_groups pg') && queryText.includes('0::numeric AS min_unit_price')) {
        expect(params).toEqual(['user-1', 'mussa', '%mussa%', 'kg'])
        return {
          rows: [
            {
              id: 11,
              display_name: 'Mussarela',
              base_unit: 'kg',
              comparable_occurrences: '0',
              min_unit_price: '0',
              avg_unit_price: '0',
              max_unit_price: '0',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups?view=all&search=mussa&base_unit=kg')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      groups: [
        {
          id: 11,
          display_name: 'Mussarela',
          base_unit: 'kg',
          comparable_occurrences: 0,
          min_unit_price: 0,
          avg_unit_price: 0,
          max_unit_price: 0,
        },
      ],
    })
  })

  it('returns an empty list when comparable groups schema is not available yet', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM product_groups pg')) {
        const error = new Error('relation "product_groups" does not exist') as Error & { code: string }
        error.code = '42P01'
        throw error
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(
      new Request('http://localhost/api/product-groups?view=comparable&search=leite&period_days=90')
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ groups: [] })
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
