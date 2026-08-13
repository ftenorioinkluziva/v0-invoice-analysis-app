import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const withUserTransaction = vi.fn(async (
  _userId: string,
  operation: (client: ReturnType<typeof createClient>) => unknown
) => operation(await connect()))
const connect = vi.fn()

vi.mock('@/lib/auth-session', () => ({
  getSessionUserId,
}))

vi.mock('@/lib/session-sql', () => ({
  withUserTransaction,
}))

describe('/api/products/[id]/group-assignment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('associates the product when evidence is missing but explicitly allowed', async () => {
    const client = createClient(async (queryText, params) => {
      if (queryText.includes('SELECT id, comparable_group_id') && queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: null, units_per_pack: null }] }
      }

      if (queryText.includes('SELECT id, display_name, base_unit') && queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafe', base_unit: 'kg' }] }
      }

      if (queryText.includes('SELECT ii.comparable_base_unit')) {
        return { rows: [] }
      }

      if (queryText.includes('comparable_unit_price IS NULL')) {
        return { rows: [] }
      }

      if (queryText.includes('UPDATE products') || queryText.includes('INSERT INTO product_group_membership_events')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: 3, allow_missing_comparable_evidence: true }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(200)
    expect(withUserTransaction).toHaveBeenCalledWith('user-1', expect.any(Function))
    await expect(response.json()).resolves.toEqual({
      product_id: 7,
      group_id: 3,
      display_name: 'Cafe',
      base_unit: 'kg',
    })
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO product_group_membership_events'), [7, 3, 'user-1', 'user-1'])
  })

  it('returns 400 when there is no comparable evidence and override is missing', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: null }] }
      }

      if (queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafe', base_unit: 'kg' }] }
      }

      if (queryText.includes('SELECT ii.comparable_base_unit')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: 3 }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 for incompatible comparable unit evidence', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: null }] }
      }

      if (queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafe', base_unit: 'kg' }] }
      }

      if (queryText.includes('SELECT ii.comparable_base_unit')) {
        return { rows: [{ comparable_base_unit: 'L' }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: 3 }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(400)
  })

  it('returns 409 when the product is already associated to another group', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: 10 }] }
      }

      if (queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafe', base_unit: 'kg' }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: 3 }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(409)
  })

  it('returns 200 without auditing when already associated to the same group', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: 3 }] }
      }

      if (queryText.includes('FROM product_groups')) {
        return { rows: [{ id: 3, display_name: 'Cafe', base_unit: 'kg' }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { POST } = await import('./route')
    const response = await POST(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ group_id: 3 }),
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(200)
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO product_group_membership_events'), expect.anything())
  })

  it('removes the assignment and records an audit event', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: 3 }] }
      }

      if (queryText.includes('UPDATE products') || queryText.includes('INSERT INTO product_group_membership_events')) {
        return { rows: [] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { DELETE } = await import('./route')
    const response = await DELETE(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(204)
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO product_group_membership_events'), [7, 3, 'user-1', 'user-1'])
  })

  it('keeps delete idempotent when the product is already without a group', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('FROM products')) {
        return { rows: [{ id: 7, comparable_group_id: null }] }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { DELETE } = await import('./route')
    const response = await DELETE(
      new Request('http://localhost/api/products/7/group-assignment', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: '7' }) }
    )

    expect(response.status).toBe(204)
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO product_group_membership_events'), expect.anything())
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
