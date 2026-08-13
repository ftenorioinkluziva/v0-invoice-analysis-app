import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preference = await withUserTransaction(userId, async (client) => {
      const rows = await client.query(
        'SELECT * FROM user_preferences WHERE user_id = $1 LIMIT 1',
        [userId]
      )
      if (rows.rows.length > 0) return rows.rows[0]

      const created = await client.query(`
        INSERT INTO user_preferences (
          alert_threshold, notify_price_increase, notify_opportunities,
          notify_restock_reminders, notify_weekly_summary, user_id
        ) VALUES (15, true, true, true, false, $1)
        RETURNING *
      `, [userId])

      return created.rows[0]
    })

    return NextResponse.json(preference)
  } catch (error) {
    console.error('Failed to fetch user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user preferences' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    
    const updates: string[] = []
    const values: unknown[] = []
    let i = 1
    
    const validFields = [
      'alert_threshold', 
      'notify_price_increase', 
      'notify_opportunities', 
      'notify_restock_reminders', 
      'notify_weekly_summary'
    ]
    
    for (const key of validFields) {
      if (data[key] !== undefined) {
        updates.push(`${key} = $${i}`)
        values.push(data[key])
        i++
      }
    }
    
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    
    const query = `
      UPDATE user_preferences 
      SET ${updates.join(', ')} 
      WHERE user_id = $${i}
      RETURNING *
    `
    values.push(userId)
    const preference = await withUserTransaction(userId, async (client) => {
      const { rows } = await client.query(query, values)
      if (rows.length > 0) return rows[0]

      const insertedFields = ['user_id', ...validFields.filter((key) => data[key] !== undefined)]
      const insertedValues = [userId, ...validFields.filter((key) => data[key] !== undefined).map((key) => data[key])]
      const placeholders = insertedValues.map((_, index) => `$${index + 1}`).join(', ')
      const insertQuery = `
        INSERT INTO user_preferences (${insertedFields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `

      const insertResult = await client.query(insertQuery, insertedValues)
      return insertResult.rows[0]
    })

    return NextResponse.json(preference)
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    )
  }
}
