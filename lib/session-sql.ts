import type { PoolClient } from 'pg'
import { getPool } from '@/lib/db-pool'

export class InvalidAppUserIdError extends Error {
  readonly code = 'INVALID_APP_USER_ID'

  constructor() {
    super('A non-empty app user id is required for tenant database access')
    this.name = 'InvalidAppUserIdError'
  }
}

function validateAppUserId(userId: string): string {
  const normalizedUserId = userId.trim()

  if (!normalizedUserId) {
    throw new InvalidAppUserIdError()
  }

  return normalizedUserId
}

/**
 * Seta a variável de sessão app.user_id para isolamento RLS estrito.
 * Deve ser chamado logo após obter o client da pool.
 */
export async function setAppUserId(client: PoolClient, userId: string) {
  await client.query("SELECT set_config('app.user_id', $1, true)", [validateAppUserId(userId)])
}

/**
 * Executa uma operação tenant-aware na mesma conexão e transação usada pelo RLS.
 * O contexto app.user_id é local à transação e nunca vaza de volta para a pool.
 */
export async function withUserTransaction<T>(
  userId: string,
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const validatedUserId = validateAppUserId(userId)
  const client = await getPool().connect()

  try {
    await client.query('BEGIN')
    await setAppUserId(client, validatedUserId)
    const result = await operation(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error('Failed to rollback user database transaction:', rollbackError)
    }
    throw error
  } finally {
    client.release()
  }
}
