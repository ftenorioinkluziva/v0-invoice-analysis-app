import { PoolClient } from '@neondatabase/serverless'

/**
 * Seta a variável de sessão app.user_id para isolamento RLS estrito.
 * Deve ser chamado logo após obter o client da pool.
 */
export async function setAppUserId(client: PoolClient, userId: string) {
  // SET LOCAL não suporta parâmetros $1 — usa literal escapado
  const escaped = userId.replace(/'/g, "''")
  await client.query(`SET LOCAL app.user_id = '${escaped}'`)
}
