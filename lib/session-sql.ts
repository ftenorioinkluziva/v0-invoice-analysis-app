import { PoolClient } from '@neondatabase/serverless'

/**
 * Seta a variável de sessão app.user_id para isolamento RLS estrito.
 * Deve ser chamado logo após obter o client da pool.
 */
export async function setAppUserId(client: PoolClient, userId: string) {
  // O comando SET LOCAL só vale para a transação atual
  await client.query('SET LOCAL app.user_id = $1', [userId])
}
