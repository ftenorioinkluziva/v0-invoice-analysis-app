import { Pool } from 'pg'
import { getSessionUserId } from '@/lib/auth-session'
import { isMissingRelationError } from '@/lib/db-errors'
import { setAppUserId } from '@/lib/session-sql'
import { parseHistoryPeriodDaysParam } from '@/lib/validations'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url)
  const periodDaysResult = parseHistoryPeriodDaysParam(searchParams.get('period_days'))

  if (!periodDaysResult.success) {
    return Response.json({ error: 'Invalid period_days' }, { status: 400 })
  }

  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const groupId = Number(id)

    if (!Number.isInteger(groupId) || groupId <= 0) {
      return Response.json({ error: 'Product group not found' }, { status: 404 })
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()

    try {
      await client.query('BEGIN')
      await setAppUserId(client, userId)

      const periodDays = periodDaysResult.data
      const groupResult = await client.query(
        `
          SELECT id, display_name, base_unit
          FROM product_groups
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
        [groupId, userId]
      )

      if (groupResult.rows.length === 0) {
        await client.query('ROLLBACK')
        return Response.json({ error: 'Product group not found' }, { status: 404 })
      }

      const membersResult = await client.query(
        `
          SELECT
            p.id AS product_id,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.brand, p.normalized_name)), ''), p.normalized_name) AS product_label,
            p.brand
          FROM products p
          WHERE p.comparable_group_id = $1 AND p.user_id = $2
          ORDER BY product_label ASC
        `,
        [groupId, userId]
      )

      const aggregatesResult = await client.query(
        `
          SELECT
            MIN(ii.comparable_unit_price) AS min_unit_price,
            AVG(ii.comparable_unit_price) AS avg_unit_price,
            MAX(ii.comparable_unit_price) AS max_unit_price
          FROM products p
          JOIN invoice_items ii ON ii.product_id = p.id AND ii.user_id = p.user_id
          JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = p.user_id
          JOIN product_groups pg ON pg.id = p.comparable_group_id AND pg.user_id = p.user_id
          WHERE p.comparable_group_id = $1
            AND p.user_id = $2
            AND ii.comparable_unit_price IS NOT NULL
            AND ii.comparable_base_unit = pg.base_unit
            AND i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
        `,
        [groupId, userId, periodDays]
      )

      const recentItemsResult = await client.query(
        `
          SELECT
            ii.id AS invoice_item_id,
            i.purchase_date,
            ii.comparable_unit_price,
            p.id AS product_id,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.brand, p.normalized_name)), ''), p.normalized_name) AS product_label
          FROM products p
          JOIN invoice_items ii ON ii.product_id = p.id AND ii.user_id = p.user_id
          JOIN invoices i ON i.id = ii.invoice_id AND i.user_id = p.user_id
          JOIN product_groups pg ON pg.id = p.comparable_group_id AND pg.user_id = p.user_id
          WHERE p.comparable_group_id = $1
            AND p.user_id = $2
            AND ii.comparable_unit_price IS NOT NULL
            AND ii.comparable_base_unit = pg.base_unit
            AND i.purchase_date >= CURRENT_DATE - ($3::int * INTERVAL '1 day')
          ORDER BY i.purchase_date DESC, ii.id DESC
          LIMIT 5
        `,
        [groupId, userId, periodDays]
      )

      await client.query('COMMIT')

      return Response.json({
        id: Number(groupResult.rows[0].id),
        display_name: String(groupResult.rows[0].display_name),
        base_unit: groupResult.rows[0].base_unit,
        members: membersResult.rows.map(member => ({
          product_id: Number(member.product_id),
          product_label: String(member.product_label),
          brand: member.brand ? String(member.brand) : null,
        })),
        aggregates: {
          min_unit_price: Number(aggregatesResult.rows[0]?.min_unit_price) || 0,
          avg_unit_price: Number(aggregatesResult.rows[0]?.avg_unit_price) || 0,
          max_unit_price: Number(aggregatesResult.rows[0]?.max_unit_price) || 0,
        },
        recent_items: recentItemsResult.rows.map(item => ({
          invoice_item_id: Number(item.invoice_item_id),
          purchase_date: item.purchase_date,
          comparable_unit_price: Number(item.comparable_unit_price),
          product_id: Number(item.product_id),
          product_label: String(item.product_label),
        })),
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    if (isMissingRelationError(error, 'product_groups')) {
      return Response.json({ error: 'Product group not found' }, { status: 404 })
    }

    console.error('Error fetching comparable product group history:', error)
    return Response.json({ error: 'Failed to fetch product group history' }, { status: 500 })
  }
}
