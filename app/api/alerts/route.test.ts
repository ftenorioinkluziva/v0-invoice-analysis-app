import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const withUserTransaction = vi.fn(async (_userId: string, operation: (client: unknown) => unknown) =>
  operation(client)
)
const client = {
  query: vi.fn(),
}

vi.mock('@/lib/auth-session', () => ({ getSessionUserId }))
vi.mock('@/lib/session-sql', () => ({ withUserTransaction }))

describe('/api/alerts', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('lists alerts through the tenant repository', async () => {
    const rows = [{
      id: 7,
      alert_type: 'price_increase',
      message: 'Tomate aumentou 20%',
      data: { variation: 20 },
      read: false,
      created_at: '2026-08-13T10:00:00.000Z',
      product_name: 'tomate',
      category: 'hortifruti',
    }]
    client.query.mockResolvedValue({ rows })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/alerts'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ alerts: rows })
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('FROM alerts a'),
      ['user-1', 50]
    )
  })

  it('updates read state through the tenant repository', async () => {
    client.query.mockResolvedValue({ rows: [] })

    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/alerts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 7, read: true }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(client.query).toHaveBeenCalledWith(
      'UPDATE alerts SET read = $1 WHERE id = $2 AND user_id = $3',
      [true, 7, 'user-1']
    )
  })

  it('rejects invalid updates before opening a transaction', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/alerts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 0, read: 'yes' }),
    }))

    expect(response.status).toBe(400)
    expect(withUserTransaction).not.toHaveBeenCalled()
  })
})
