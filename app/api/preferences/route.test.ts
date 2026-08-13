import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const withUserTransaction = vi.fn(async (_userId: string, operation: (client: unknown) => unknown) =>
  operation(client)
)
const client = { query: vi.fn() }

vi.mock('@/lib/auth-session', () => ({ getSessionUserId }))
vi.mock('@/lib/session-sql', () => ({ withUserTransaction }))

describe('/api/preferences', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('gets existing preferences through the tenant repository', async () => {
    const preference = { id: 1, alert_threshold: 15, notify_price_increase: true }
    client.query.mockResolvedValue({ rows: [preference] })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/preferences'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(preference)
    expect(client.query).toHaveBeenCalledWith(
      'SELECT * FROM user_preferences WHERE user_id = $1 LIMIT 1',
      ['user-1']
    )
  })

  it('creates default preferences when the tenant has none', async () => {
    const preference = { id: 1, alert_threshold: 15, notify_price_increase: true }
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [preference] })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/preferences'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(preference)
    expect(client.query).toHaveBeenCalledTimes(2)
    expect(client.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO user_preferences'),
      ['user-1']
    )
  })

  it('updates only validated fields', async () => {
    const preference = { id: 1, alert_threshold: 20, notify_price_increase: true }
    client.query.mockResolvedValue({ rows: [preference] })

    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alert_threshold: 20 }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(preference)
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE user_preferences'),
      [20, 'user-1']
    )
  })

  it('inserts a partial preference row when an update has no existing row', async () => {
    const preference = { id: 1, alert_threshold: 20 }
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [preference] })

    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alert_threshold: 20 }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(preference)
    expect(client.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO user_preferences (user_id, alert_threshold)'),
      ['user-1', 20]
    )
  })

  it('rejects invalid values before opening a transaction', async () => {
    const { PATCH } = await import('./route')
    const response = await PATCH(new Request('http://localhost/api/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alert_threshold: 150 }),
    }))

    expect(response.status).toBe(400)
    expect(withUserTransaction).not.toHaveBeenCalled()
  })
})
