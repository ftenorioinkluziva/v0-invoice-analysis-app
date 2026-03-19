import { sql } from '@/lib/db'
import { UpdateAlertSchema } from '@/lib/validations'

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
    const parsed = UpdateAlertSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, read } = parsed.data

    await sql`
      UPDATE alerts SET read = ${read} WHERE id = ${id}
    `
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating alert:', error)
    return Response.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
