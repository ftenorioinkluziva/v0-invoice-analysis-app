import { sql } from '@/lib/db'
import { CreateShoppingListSchema } from '@/lib/validations'

export async function GET() {
  try {
    const lists = await sql`
      SELECT 
        sl.id,
        sl.name,
        sl.status,
        sl.created_at,
        COUNT(sli.id) as item_count,
        SUM(CASE WHEN sli.checked THEN 1 ELSE 0 END) as checked_count,
        SUM(COALESCE(sli.estimated_price, 0) * sli.quantity) as estimated_total
      FROM shopping_lists sl
      LEFT JOIN shopping_list_items sli ON sl.id = sli.list_id
      GROUP BY sl.id, sl.name, sl.status, sl.created_at
      ORDER BY sl.created_at DESC
    `
    return Response.json({ lists })
  } catch (error) {
    console.error('Error fetching shopping lists:', error)
    return Response.json({ error: 'Failed to fetch shopping lists' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const parsed = CreateShoppingListSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { name } = parsed.data

    const result = await sql`
      INSERT INTO shopping_lists (name, status)
      VALUES (${name || 'Nova Lista'}, 'active')
      RETURNING id, name, status, created_at
    `
    
    return Response.json({ list: result[0] })
  } catch (error) {
    console.error('Error creating shopping list:', error)
    return Response.json({ error: 'Failed to create shopping list' }, { status: 500 })
  }
}
