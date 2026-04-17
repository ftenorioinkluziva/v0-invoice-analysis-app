import { Pool } from '@neondatabase/serverless'

let _pool: Pool | null = null

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  }
  return _pool
}
