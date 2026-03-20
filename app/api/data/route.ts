import { Pool } from '@neondatabase/serverless'

export async function DELETE() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      
      // Deletion order to respect foreign key constraints
      await client.query('DELETE FROM alerts')
      await client.query('DELETE FROM invoice_items')
      await client.query('DELETE FROM shopping_list_items')
      await client.query('DELETE FROM invoices')
      await client.query('DELETE FROM shopping_lists')
      await client.query('DELETE FROM products')
      await client.query('DELETE FROM stores')

      await client.query('COMMIT')
      client.release()

      return Response.json({ success: true, message: 'All data deleted successfully' })
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
