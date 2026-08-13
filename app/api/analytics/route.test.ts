import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const withUserTransaction = vi.fn(async (_userId: string, operation: (client: unknown) => unknown) =>
  operation(client)
)
const client = { query: vi.fn() }

vi.mock('@/lib/auth-session', () => ({ getSessionUserId }))
vi.mock('@/lib/session-sql', () => ({ withUserTransaction }))

describe('GET /api/analytics', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('returns dashboard stats through the tenant repository', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ total: '120' }] })
      .mockResolvedValueOnce({ rows: [{ total: '100' }] })
      .mockResolvedValueOnce({ rows: [{ invoice_count: '4', product_count: '12' }] })
      .mockResolvedValueOnce({ rows: [{ month: '2026-08', total: '120' }] })
      .mockResolvedValueOnce({ rows: [{
        product_name: 'tomate',
        price_variation: '20',
        current_price: '12',
        previous_price: '10',
      }] })
      .mockResolvedValueOnce({ rows: [{ inflation: '8.5' }] })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/analytics'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      total_spent_month: 120,
      total_spent_last_month: 100,
      month_variation_percent: 20,
      total_invoices: 4,
      total_products: 12,
      personal_inflation: 8.5,
      top_price_increases: [{
        product_name: 'tomate',
        price_variation: 20,
        current_price: 12,
        previous_price: 10,
      }],
      spending_by_month: [{ month: '2026-08', total: 120 }],
    })
    expect(withUserTransaction).toHaveBeenCalledTimes(1)
  })

  it('returns 401 without a session', async () => {
    getSessionUserId.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/analytics'))

    expect(response.status).toBe(401)
    expect(withUserTransaction).not.toHaveBeenCalled()
  })
})
