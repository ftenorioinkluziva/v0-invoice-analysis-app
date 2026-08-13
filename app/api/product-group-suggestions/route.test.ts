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

describe('GET /api/product-group-suggestions', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    getSessionUserId.mockResolvedValue('user-1')
  })

  it('recomputes and returns pending suggestions ordered for the active user', async () => {
    const client = createClient(async (queryText) => {
      if (queryText.includes('WITH latest_comparable_evidence AS')) {
        return {
          rows: [
            {
              id: 7,
              normalized_name: 'cafe pilao 500g',
              category: 'Bebidas',
              brand: 'Pilao',
              comparable_group_id: null,
              comparable_base_unit: 'kg',
            },
          ],
        }
      }

      if (queryText.includes('FROM product_groups pg')) {
        return {
          rows: [
            {
              group_id: 3,
              display_name: 'Cafes',
              base_unit: 'kg',
              member_product_id: 9,
              normalized_name: 'cafe tres coracoes 500g',
              category: 'Bebidas',
              brand: 'Tres Coracoes',
            },
          ],
        }
      }

      if (queryText.includes('FROM product_group_suggestions') && queryText.includes("status = 'rejected'")) {
        return { rows: [] }
      }

      if (queryText.includes('UPDATE product_group_suggestions') && queryText.includes("status = 'superseded'")) {
        return { rows: [] }
      }

      if (queryText.includes('INSERT INTO product_group_suggestions')) {
        return { rows: [] }
      }

      if (queryText.includes('FROM product_group_suggestions') && queryText.includes("status = 'pending'")) {
        return {
          rows: [
            {
              id: 21,
              source_product_id: 7,
              target_group_id: 3,
              confidence: 0.767,
              reasons: ['Unidade base compativel', 'Categoria igual'],
              status: 'pending',
            },
          ],
        }
      }

      throw new Error(`Unexpected query: ${queryText}`)
    })

    connect.mockResolvedValue(client)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/product-group-suggestions'))

    expect(response.status).toBe(200)
    expect(withUserTransaction).toHaveBeenCalledWith('user-1', expect.any(Function))
    await expect(response.json()).resolves.toEqual([
      {
        id: 21,
        source_product_id: 7,
        target_group_id: 3,
        confidence: 0.767,
        reasons: ['Unidade base compativel', 'Categoria igual'],
        status: 'pending',
      },
    ])
  })

  it('returns 401 without session', async () => {
    getSessionUserId.mockResolvedValue(null)

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/product-group-suggestions'))

    expect(response.status).toBe(401)
    expect(connect).not.toHaveBeenCalled()
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
