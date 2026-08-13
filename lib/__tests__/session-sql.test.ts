import type { PoolClient } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { connect } = vi.hoisted(() => ({
  connect: vi.fn(),
}))

vi.mock('@/lib/db-pool', () => ({
  getPool: () => ({ connect }),
}))

import {
  InvalidAppUserIdError,
  setAppUserId,
  withUserTransaction,
} from '@/lib/session-sql'

function createClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  } as unknown as PoolClient
}

describe('tenant database transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets app.user_id with a parameterized transaction-local setting', async () => {
    const client = createClient()

    await setAppUserId(client, ' user-123 ')

    expect(client.query).toHaveBeenCalledWith(
      "SELECT set_config('app.user_id', $1, true)",
      ['user-123']
    )
  })

  it('commits the operation before releasing the pooled connection', async () => {
    const client = createClient()
    connect.mockResolvedValue(client)

    const result = await withUserTransaction('user-123', async (transactionClient) => {
      expect(transactionClient).toBe(client)
      await transactionClient.query('SELECT 1')
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN')
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.user_id', $1, true)",
      ['user-123']
    )
    expect(client.query).toHaveBeenNthCalledWith(3, 'SELECT 1')
    expect(client.query).toHaveBeenNthCalledWith(4, 'COMMIT')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('rolls back and releases when the operation fails', async () => {
    const client = createClient()
    connect.mockResolvedValue(client)
    const failure = new Error('query failed')

    await expect(
      withUserTransaction('user-123', async () => {
        throw failure
      })
    ).rejects.toBe(failure)

    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK')
    expect(client.release).toHaveBeenCalledOnce()
  })

  it('rejects an empty tenant id before acquiring a connection', async () => {
    await expect(withUserTransaction('   ', async () => undefined)).rejects.toBeInstanceOf(
      InvalidAppUserIdError
    )
    expect(connect).not.toHaveBeenCalled()
  })
})
