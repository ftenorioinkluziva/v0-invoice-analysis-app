import { getPool } from '@/lib/db-pool'
import { AddListItemSchema, UpdateListItemSchema, DeleteListItemSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { getComparableReferenceLabel, toNullableNumber } from '@/lib/shopping-list'
import type { ComparableBaseUnit } from '@/lib/types'

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

    const client = await getPool().connect()

    try {
      // 1 roundtrip: tudo resolvido via CTEs numa única query
      const result = await client.query(
        `
          WITH list_check AS (
            SELECT id, name, status, created_at, user_id
            FROM shopping_lists
            WHERE id = $1 AND user_id = $2
            LIMIT 1
          ),
          list_items AS (
            SELECT
              sli.id,
              sli.quantity,
              sli.checked,
              sli.estimated_price,
              p.id AS product_id,
              p.normalized_name,
              p.category,
              p.comparable_group_id,
              ph.last_price,
              ph.previous_price,
              CASE
                WHEN ph.previous_price IS NOT NULL AND ph.previous_price <> 0
                THEN ((ph.last_price - ph.previous_price) / ph.previous_price) * 100
                ELSE 0
              END AS price_variation,
              cp.comparable_unit_price,
              pg.base_unit AS comparable_base_unit,
              pg.display_name AS comparable_group_name
            FROM shopping_list_items sli
            JOIN products p ON p.id = sli.product_id AND p.user_id = sli.user_id
            LEFT JOIN product_groups pg ON pg.id = p.comparable_group_id AND pg.user_id = p.user_id
            LEFT JOIN LATERAL (
              SELECT
                MIN(unit_price) FILTER (WHERE rn = 1) AS last_price,
                MIN(unit_price) FILTER (WHERE rn = 2) AS previous_price
              FROM (
                SELECT ii.unit_price,
                       ROW_NUMBER() OVER (ORDER BY i.purchase_date DESC, ii.id DESC) AS rn
                FROM invoice_items ii
                JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = ii.user_id
                WHERE ii.product_id = p.id AND ii.user_id = p.user_id
                LIMIT 2
              ) ranked
            ) ph ON true
            LEFT JOIN LATERAL (
              SELECT AVG(ii5.comparable_unit_price) AS comparable_unit_price
              FROM products gp
              JOIN invoice_items ii5 ON ii5.product_id = gp.id AND ii5.user_id = gp.user_id
              JOIN invoices i5 ON i5.id = ii5.invoice_id AND i5.user_id = gp.user_id
              WHERE gp.comparable_group_id = p.comparable_group_id
                AND gp.user_id = p.user_id
                AND p.comparable_group_id IS NOT NULL
                AND ii5.comparable_unit_price IS NOT NULL
                AND ii5.comparable_base_unit = pg.base_unit
                AND i5.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
            ) cp ON true
            WHERE sli.list_id = $1 AND sli.user_id = $2
            ORDER BY sli.checked ASC, p.category ASC, p.normalized_name ASC
          ),
          suggestion_rows AS (
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
            WHERE p.user_id = $2
              AND p.id NOT IN (
                SELECT product_id FROM shopping_list_items WHERE list_id = $1 AND user_id = $2
              )
            GROUP BY p.id, p.normalized_name, p.category
            HAVING COUNT(ii.id) >= 2
            ORDER BY COUNT(ii.id) DESC, EXTRACT(DAY FROM NOW() - MAX(i.purchase_date)) DESC
            LIMIT 5
          )
          SELECT
            (SELECT row_to_json(list_check) FROM list_check) AS list,
            COALESCE((SELECT json_agg(list_items ORDER BY checked ASC, category ASC, normalized_name ASC) FROM list_items), '[]') AS items,
            COALESCE((SELECT json_agg(suggestion_rows) FROM suggestion_rows), '[]') AS suggestions
        `,
        [listId, userId, 90]
      )

      const row = result.rows[0]

      if (!row.list) {
        return Response.json({ error: 'List not found' }, { status: 404 })
      }

      const rawItems: Record<string, unknown>[] = row.items
      const rawSuggestions: Record<string, unknown>[] = row.suggestions

      return Response.json({
        list: row.list,
        items: rawItems.map(item => ({
          id: Number(item.id),
          quantity: Number(item.quantity),
          checked: Boolean(item.checked),
          estimated_price: toNullableNumber(item.estimated_price),
          product_id: Number(item.product_id),
          normalized_name: String(item.normalized_name),
          category: item.category ? String(item.category) : null,
          last_price: toNullableNumber(item.last_price),
          previous_price: toNullableNumber(item.previous_price),
          price_variation: Number(item.price_variation) || 0,
          comparable_unit_price: toNullableNumber(item.comparable_unit_price),
          comparable_base_unit: item.comparable_base_unit ? String(item.comparable_base_unit) : null,
          comparable_reference_label: getComparableReferenceLabel(
            item.comparable_base_unit ? String(item.comparable_base_unit) as ComparableBaseUnit : null
          ),
          comparable_group_name: item.comparable_group_name ? String(item.comparable_group_name) : null,
        })),
        suggestions: rawSuggestions.map(s => ({
          ...s,
          avg_price: Number(s.avg_price) || 0,
          days_since_purchase: Number(s.days_since_purchase) || 0,
        })),
      })
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
    const parsed = AddListItemSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { product_id, quantity } = parsed.data

    // 1 roundtrip: verifica ownership + busca preço + upsert via CTE
    const client = await getPool().connect()
    try {
      const result = await client.query(
        `
          WITH ownership AS (
            SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2 LIMIT 1
          ),
          last_price AS (
            SELECT ii.unit_price
            FROM invoice_items ii
            JOIN invoices i ON ii.invoice_id = i.id AND i.user_id = ii.user_id
            WHERE ii.product_id = $3 AND ii.user_id = $2
            ORDER BY i.purchase_date DESC, ii.id DESC
            LIMIT 1
          ),
          upsert AS (
            INSERT INTO shopping_list_items (list_id, product_id, quantity, estimated_price, user_id)
            SELECT $1, $3, $4, (SELECT unit_price FROM last_price), $2
            WHERE EXISTS (SELECT 1 FROM ownership)
            ON CONFLICT (list_id, product_id, user_id) DO UPDATE
              SET quantity = shopping_list_items.quantity + EXCLUDED.quantity
            RETURNING id, (xmax <> 0) AS updated
          )
          SELECT
            (SELECT id FROM ownership) AS list_exists,
            (SELECT id FROM upsert) AS item_id,
            (SELECT updated FROM upsert) AS updated
        `,
        [listId, userId, product_id, quantity]
      )

      const row = result.rows[0]
      if (!row.list_exists) {
        return Response.json({ error: 'List not found' }, { status: 404 })
      }

      return Response.json({ success: true, itemId: row.item_id, updated: row.updated })
    } finally {
      client.release()
    }
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

    // Lê body e params em paralelo antes de qualquer query
    const [{ id }, body] = await Promise.all([params, request.json()])
    const listId = parseInt(id)

    const parsed = UpdateListItemSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { item_id, checked, quantity, status } = parsed.data

    const client = await getPool().connect()
    try {
      let found = false

      if (status) {
        // 1 query: ownership + update de status embutido no WHERE
        const r = await client.query(
          `UPDATE shopping_lists SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING id`,
          [status, listId, userId]
        )
        found = r.rowCount !== null && r.rowCount > 0
      } else if (item_id !== undefined) {
        // Verifica ownership da lista e atualiza item em 2 queries paralelas via Promise.all quando ambos os campos presentes,
        // ou 1 query quando só um campo muda
        const ownershipQ = client.query(
          `SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2 LIMIT 1`,
          [listId, userId]
        )

        if (checked !== undefined && quantity !== undefined) {
          const [ownership, updateResult] = await Promise.all([
            ownershipQ,
            client.query(
              `UPDATE shopping_list_items SET checked = $1, quantity = $2 WHERE id = $3 AND user_id = $4`,
              [checked, quantity, item_id, userId]
            ),
          ])
          found = ownership.rows.length > 0
        } else if (checked !== undefined) {
          const [ownership] = await Promise.all([
            ownershipQ,
            client.query(
              `UPDATE shopping_list_items SET checked = $1 WHERE id = $2 AND user_id = $3`,
              [checked, item_id, userId]
            ),
          ])
          found = ownership.rows.length > 0
        } else if (quantity !== undefined) {
          const [ownership] = await Promise.all([
            ownershipQ,
            client.query(
              `UPDATE shopping_list_items SET quantity = $1 WHERE id = $2 AND user_id = $3`,
              [quantity, item_id, userId]
            ),
          ])
          found = ownership.rows.length > 0
        } else {
          const ownership = await ownershipQ
          found = ownership.rows.length > 0
        }
      }

      if (!found) {
        return Response.json({ error: 'List not found' }, { status: 404 })
      }

      return Response.json({ success: true })
    } finally {
      client.release()
    }
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

    const [{ id }, body] = await Promise.all([params, request.json()])
    const listId = parseInt(id)

    const parsed = DeleteListItemSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { item_id } = parsed.data

    const client = await getPool().connect()
    try {
      let found = false

      if (item_id) {
        // 1 query: deleta item apenas se pertence ao usuário e à lista correta
        const r = await client.query(
          `
            DELETE FROM shopping_list_items
            WHERE id = $1 AND user_id = $2
              AND list_id IN (SELECT id FROM shopping_lists WHERE id = $3 AND user_id = $2)
            RETURNING id
          `,
          [item_id, userId, listId]
        )
        found = r.rowCount !== null && r.rowCount > 0
      } else {
        // Deleta lista inteira — items deletados em cascata (ON DELETE CASCADE no schema)
        const r = await client.query(
          `DELETE FROM shopping_lists WHERE id = $1 AND user_id = $2 RETURNING id`,
          [listId, userId]
        )
        found = r.rowCount !== null && r.rowCount > 0
      }

      if (!found) {
        return Response.json({ error: 'List not found' }, { status: 404 })
      }

      return Response.json({ success: true })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error deleting:', error)
    return Response.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
