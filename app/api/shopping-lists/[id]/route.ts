import { sql } from '@/lib/db'
import { AddListItemSchema, UpdateListItemSchema, DeleteListItemSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(_request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const listId = parseInt(id)

    const list = await sql`
      SELECT * FROM shopping_lists WHERE id = ${listId} AND user_id = ${userId} LIMIT 1
    `

    if (list.length === 0) {
      return Response.json({ error: 'List not found' }, { status: 404 })
    }

    const items = await sql`
      SELECT 
        sli.id,
        sli.quantity,
        sli.checked,
        sli.estimated_price,
        p.id as product_id,
        p.normalized_name,
        p.category,
        (
          SELECT ii.unit_price 
          FROM invoice_items ii 
          JOIN invoices i ON ii.invoice_id = i.id 
          WHERE ii.product_id = p.id 
          ORDER BY i.purchase_date DESC 
          LIMIT 1
        ) as last_price,
        (
          SELECT ((
            (SELECT ii2.unit_price FROM invoice_items ii2 JOIN invoices i2 ON ii2.invoice_id = i2.id WHERE ii2.product_id = p.id ORDER BY i2.purchase_date DESC LIMIT 1) -
            (SELECT ii3.unit_price FROM invoice_items ii3 JOIN invoices i3 ON ii3.invoice_id = i3.id WHERE ii3.product_id = p.id ORDER BY i3.purchase_date DESC LIMIT 1 OFFSET 1)
          ) / NULLIF((SELECT ii4.unit_price FROM invoice_items ii4 JOIN invoices i4 ON ii4.invoice_id = i4.id WHERE ii4.product_id = p.id ORDER BY i4.purchase_date DESC LIMIT 1 OFFSET 1), 0)) * 100
        ) as price_variation
      FROM shopping_list_items sli
      JOIN products p ON sli.product_id = p.id
      WHERE sli.list_id = ${listId} AND sli.user_id = ${userId} AND p.user_id = ${userId}
      ORDER BY sli.checked ASC, p.category ASC, p.normalized_name ASC
    `

    // Get suggested products based on purchase frequency
    const suggestions = await sql`
      SELECT 
        p.id as product_id,
        p.normalized_name,
        p.category,
        COUNT(ii.id) as purchase_count,
        MAX(i.purchase_date) as last_purchase,
        AVG(ii.unit_price) as avg_price,
        EXTRACT(DAY FROM NOW() - MAX(i.purchase_date)) as days_since_purchase
      FROM products p
      JOIN invoice_items ii ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE p.user_id = ${userId} AND ii.user_id = ${userId} AND i.user_id = ${userId}
      AND p.id NOT IN (
        SELECT product_id FROM shopping_list_items WHERE list_id = ${listId} AND user_id = ${userId}
      )
      GROUP BY p.id, p.normalized_name, p.category
      HAVING COUNT(ii.id) >= 2
      ORDER BY
        COUNT(ii.id) DESC,
        EXTRACT(DAY FROM NOW() - MAX(i.purchase_date)) DESC
      LIMIT 5
    `

    return Response.json({
      list: list[0],
      items: items.map(item => ({
        ...item,
        last_price: Number(item.last_price) || 0,
        price_variation: Number(item.price_variation) || 0,
        estimated_price: Number(item.estimated_price) || 0,
      })),
      suggestions: suggestions.map(s => ({
        ...s,
        avg_price: Number(s.avg_price) || 0,
        days_since_purchase: Number(s.days_since_purchase) || 0,
      })),
    })
  } catch (error) {
    console.error('Error fetching shopping list:', error)
    return Response.json({ error: 'Failed to fetch shopping list' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const listId = parseInt(id)
    const listOwnership = await sql`
      SELECT id FROM shopping_lists WHERE id = ${listId} AND user_id = ${userId} LIMIT 1
    `
    if (listOwnership.length === 0) {
      return Response.json({ error: 'List not found' }, { status: 404 })
    }
    const parsed = AddListItemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { product_id, quantity } = parsed.data

    // Verificação de duplicata para efetuar o UPSERT
    const existingItem = await sql`
      SELECT id, quantity 
      FROM shopping_list_items 
      WHERE list_id = ${listId} AND product_id = ${product_id} AND user_id = ${userId}
    `

    if (existingItem.length > 0) {
      const newQuantity = Number(existingItem[0].quantity) + quantity
      const updateResult = await sql`
        UPDATE shopping_list_items 
        SET quantity = ${newQuantity} 
        WHERE id = ${existingItem[0].id} AND user_id = ${userId}
        RETURNING id
      `
      return Response.json({ success: true, itemId: updateResult[0].id, updated: true })
    }

    // Get estimated price from last purchase
    const lastPrice = await sql`
      SELECT ii.unit_price
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${product_id} AND ii.user_id = ${userId} AND i.user_id = ${userId}
      ORDER BY i.purchase_date DESC
      LIMIT 1
    `

    const estimatedPrice = lastPrice.length > 0 ? lastPrice[0].unit_price : null

    const result = await sql`
      INSERT INTO shopping_list_items (list_id, product_id, quantity, estimated_price, user_id)
      VALUES (${listId}, ${product_id}, ${quantity}, ${estimatedPrice}, ${userId})
      RETURNING id
    `

    return Response.json({ success: true, itemId: result[0].id })
  } catch (error) {
    console.error('Error adding item to list:', error)
    return Response.json({ error: 'Failed to add item' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const listId = parseInt(id)
    const listOwnership = await sql`
      SELECT id FROM shopping_lists WHERE id = ${listId} AND user_id = ${userId} LIMIT 1
    `
    if (listOwnership.length === 0) {
      return Response.json({ error: 'List not found' }, { status: 404 })
    }
    const parsed = UpdateListItemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { item_id, checked, quantity, status } = parsed.data

    if (status) {
      // Update list status
      await sql`
        UPDATE shopping_lists SET status = ${status} WHERE id = ${listId} AND user_id = ${userId}
      `
    } else if (item_id !== undefined) {
      // Update item
      if (checked !== undefined) {
        await sql`
          UPDATE shopping_list_items SET checked = ${checked} WHERE id = ${item_id} AND user_id = ${userId}
        `
      }
      if (quantity !== undefined) {
        await sql`
          UPDATE shopping_list_items SET quantity = ${quantity} WHERE id = ${item_id} AND user_id = ${userId}
        `
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating shopping list:', error)
    return Response.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const listId = parseInt(id)
    const listOwnership = await sql`
      SELECT id FROM shopping_lists WHERE id = ${listId} AND user_id = ${userId} LIMIT 1
    `
    if (listOwnership.length === 0) {
      return Response.json({ error: 'List not found' }, { status: 404 })
    }
    const parsed = DeleteListItemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { item_id } = parsed.data

    if (item_id) {
      await sql`DELETE FROM shopping_list_items WHERE id = ${item_id} AND user_id = ${userId}`
    } else {
      await sql`DELETE FROM shopping_list_items WHERE list_id = ${listId} AND user_id = ${userId}`
      await sql`DELETE FROM shopping_lists WHERE id = ${listId} AND user_id = ${userId}`
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting:', error)
    return Response.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
