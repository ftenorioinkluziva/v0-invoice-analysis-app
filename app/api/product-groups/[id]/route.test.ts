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

describe('PATCH /api/product-groups/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('updates only the display name for owned groups', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('UPDATE product_groups')) {
        expect(params).toEqual(['Laticinios', 4, 'user-1'])
        return {
          rows: [{ id: 4, display_name: 'Laticinios', base_unit: 'L' }],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { PATCH } = await import('./route')
    const response = await PATCH(
      new Request('http://localhost/api/product-groups/4', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: 'Laticinios' }),
      }),
      { params: Promise.resolve({ id: '4' }) }
    )

    expect(response.status).toBe(200)
    expect(withUserTransaction).toHaveBeenCalledWith('user-1', expect.any(Function))
    await expect(response.json()).resolves.toEqual({
      id: 4,
      display_name: 'Laticinios',
      base_unit: 'L',
    })
  })

  it('returns 404 for groups outside the active user scope', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('UPDATE product_groups')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { PATCH } = await import('./route')
    const response = await PATCH(
      new Request('http://localhost/api/product-groups/4', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ display_name: 'Laticinios' }),
      }),
      { params: Promise.resolve({ id: '4' }) }
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
