import { Pool } from 'pg'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()
    await setAppUserId(client, userId)

    try {
      await client.query('BEGIN')
      
      // Deletion order to respect foreign key constraints
      await client.query('DELETE FROM alerts WHERE user_id = $1', [userId])
      await client.query('DELETE FROM invoice_items WHERE user_id = $1', [userId])
      await client.query('DELETE FROM shopping_list_items WHERE user_id = $1', [userId])
      await client.query('DELETE FROM invoices WHERE user_id = $1', [userId])
      await client.query('DELETE FROM shopping_lists WHERE user_id = $1', [userId])
      await client.query('DELETE FROM products WHERE user_id = $1', [userId])
      await client.query('DELETE FROM stores WHERE user_id = $1', [userId])
      await client.query('DELETE FROM user_preferences WHERE user_id = $1', [userId])

      await client.query('COMMIT')
      client.release()

      return Response.json({ success: true, message: 'User data deleted successfully' })
    } catch (txError) {
      await client.query('ROLLBACK')
      client.release()
      throw txError
    }
  } catch (error) {
    console.error('Error deleting all data:', error)
    return Response.json({ error: 'Failed to delete data' }, { status: 500 })
  }
}
