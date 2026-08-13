import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSessionUserId = vi.fn()
const withUserTransaction = vi.fn(async (_userId: string, operation: (client: unknown) => unknown) =>
  operation(client)
)
const client = { query: vi.fn() }

vi.mock('@/lib/auth-session', () => ({ getSessionUserId }))
vi.mock('@/lib/session-sql', () => ({ withUserTransaction }))

describe('DELETE /api/data', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
    client.query.mockResolvedValue({ rows: [] })
  })

  it('requires explicit confirmation before deleting', async () => {
    const { DELETE } = await import('./route')
    const response = await DELETE(new Request('http://localhost/api/data', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation: 'apagar' }),
    }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'DATA_DELETION_CONFIRMATION_REQUIRED',
      category: 'validation',
      retryable: false,
    })
    expect(withUserTransaction).not.toHaveBeenCalled()
  })

  it('deletes all tenant entities after confirmation', async () => {
    const { DELETE } = await import('./route')
    const response = await DELETE(new Request('http://localhost/api/data', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmation: ' excluir ' }),
    }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'User data deleted successfully',
    })
    expect(client.query.mock.calls.map(([query]) => query)).toEqual([
      'DELETE FROM product_group_membership_events WHERE user_id = $1',
      'DELETE FROM product_group_suggestions WHERE user_id = $1',
      'DELETE FROM alerts WHERE user_id = $1',
      'DELETE FROM invoice_items WHERE user_id = $1',
      'DELETE FROM shopping_list_items WHERE user_id = $1',
      'DELETE FROM invoices WHERE user_id = $1',
      'DELETE FROM shopping_lists WHERE user_id = $1',
      'DELETE FROM products WHERE user_id = $1',
      'DELETE FROM product_groups WHERE user_id = $1',
      'DELETE FROM stores WHERE user_id = $1',
      'DELETE FROM user_preferences WHERE user_id = $1',
    ])
  })

  it('rejects unauthenticated destructive requests', async () => {
    getSessionUserId.mockResolvedValue(null)

    const { DELETE } = await import('./route')
    const response = await DELETE(new Request('http://localhost/api/data', { method: 'DELETE' }))

    expect(response.status).toBe(401)
    expect(withUserTransaction).not.toHaveBeenCalled()
  })
})
