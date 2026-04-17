import { Pool } from '@neondatabase/serverless'
import { sql } from '@/lib/db'
import { AddListItemSchema, UpdateListItemSchema, DeleteListItemSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'
import { getComparableReferenceLabel, toNullableNumber } from '@/lib/shopping-list'

export async function GET(
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

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const list = await client.query(
        `
          SELECT *
          FROM shopping_lists
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
        [listId, userId]
      )

      if (list.rows.length === 0) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'List not found' }, { status: 404 })
      }

      const items = await client.query(
        `
          SELECT
            sli.id,
            sli.quantity,
            sli.checked,
            sli.estimated_price,
            p.id AS product_id,
            p.normalized_name,
            p.category,
            (
              SELECT ii.unit_price
              FROM invoice_items ii
              JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = ii.user_id
              WHERE ii.product_id = p.id
                AND ii.user_id = p.user_id
              ORDER BY i.purchase_date DESC, ii.id DESC
              LIMIT 1
            ) AS last_price,
            (
              SELECT ((
                (SELECT ii2.unit_price
                  FROM invoice_items ii2
                  JOIN invoices i2 ON i2.id = ii2.invoice_id AND i2.user_id = ii2.user_id
                  WHERE ii2.product_id = p.id
                    AND ii2.user_id = p.user_id
                  ORDER BY i2.purchase_date DESC, ii2.id DESC
                  LIMIT 1) -
                (SELECT ii3.unit_price
                  FROM invoice_items ii3
                  JOIN invoices i3 ON i3.id = ii3.invoice_id AND i3.user_id = ii3.user_id
                  WHERE ii3.product_id = p.id
                    AND ii3.user_id = p.user_id
                  ORDER BY i3.purchase_date DESC, ii3.id DESC
                  LIMIT 1 OFFSET 1)
              ) / NULLIF((SELECT ii4.unit_price
                FROM invoice_items ii4
                JOIN invoices i4 ON i4.id = ii4.invoice_id AND i4.user_id = ii4.user_id
                WHERE ii4.product_id = p.id
                  AND ii4.user_id = p.user_id
                ORDER BY i4.purchase_date DESC, ii4.id DESC
                LIMIT 1 OFFSET 1), 0)) * 100
            ) AS price_variation,
            (
              SELECT AVG(ii5.comparable_unit_price)
              FROM products gp
              JOIN invoice_items ii5 ON ii5.product_id = gp.id AND ii5.user_id = gp.user_id
              JOIN invoices i5 ON i5.id = ii5.invoice_id AND i5.user_id = gp.user_id
              WHERE gp.comparable_group_id = p.comparable_group_id
                AND gp.user_id = p.user_id
                AND ii5.comparable_unit_price IS NOT NULL
                AND ii5.comparable_base_unit = pg.base_unit
                AND i5.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
            ) AS comparable_unit_price,
            pg.base_unit AS comparable_base_unit,
            pg.display_name AS comparable_group_name
          FROM shopping_list_items sli
          JOIN products p ON p.id = sli.product_id AND p.user_id = sli.user_id
          LEFT JOIN product_groups pg ON pg.id = p.comparable_group_id AND pg.user_id = p.user_id
          WHERE sli.list_id = $1 AND sli.user_id = $2
          ORDER BY sli.checked ASC, p.category ASC, p.normalized_name ASC
        `,
        [listId, userId, 90]
      )

      const suggestions = await client.query(
        `
          SELECT
            p.id AS product_id,
            p.normalized_name,
            p.category,
            COUNT(ii.id) AS purchase_count,
            MAX(i.purchase_date) AS last_purchase,
            AVG(ii.unit_price) AS avg_price,
            EXTRACT(DAY FROM NOW() - MAX(i.purchase_date)) AS days_since_purchase
          FROM products p
          JOIN invoice_items ii ON ii.product_id = p.id AND ii.user_id = p.user_id
          JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = p.user_id
          WHERE p.user_id = $1
            AND p.id NOT IN (
              SELECT product_id
              FROM shopping_list_items
              WHERE list_id = $2 AND user_id = $1
            )
          GROUP BY p.id, p.normalized_name, p.category
          HAVING COUNT(ii.id) >= 2
          ORDER BY
            COUNT(ii.id) DESC,
            EXTRACT(DAY FROM NOW() - MAX(i.purchase_date)) DESC
          LIMIT 5
        `,
        [userId, listId]
      )

      await client.query('COMMIT')

      return Response.json({
        list: list.rows[0],
        items: items.rows.map(item => ({
          id: Number(item.id),
          quantity: Number(item.quantity),
          checked: Boolean(item.checked),
          estimated_price: toNullableNumber(item.estimated_price),
          product_id: Number(item.product_id),
          normalized_name: String(item.normalized_name),
          category: item.category ? String(item.category) : null,
          last_price: toNullableNumber(item.last_price),
          price_variation: Number(item.price_variation) || 0,
          comparable_unit_price: toNullableNumber(item.comparable_unit_price),
          comparable_base_unit: item.comparable_base_unit ? String(item.comparable_base_unit) : null,
          comparable_reference_label: getComparableReferenceLabel(
            item.comparable_base_unit ? String(item.comparable_base_unit) as 'kg' | 'L' : null
          ),
          comparable_group_name: item.comparable_group_name ? String(item.comparable_group_name) : null,
        })),
        suggestions: suggestions.rows.map(s => ({
          ...s,
          avg_price: Number(s.avg_price) || 0,
          days_since_purchase: Number(s.days_since_purchase) || 0,
        })),
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
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
