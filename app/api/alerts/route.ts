import { sql } from '@/lib/db'

export async function GET() {
  try {
    const alerts = await sql`
      SELECT 
        a.id,
        a.alert_type,
        a.message,
        a.data,
        a.read,
        a.created_at,
        p.normalized_name as product_name,
        p.category
      FROM alerts a
      JOIN products p ON a.product_id = p.id
      ORDER BY a.created_at DESC
      LIMIT 50
    `
    return Response.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return Response.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, read } = await request.json()
    
    await sql`
      UPDATE alerts SET read = ${read} WHERE id = ${id}
    `
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating alert:', error)
    return Response.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
