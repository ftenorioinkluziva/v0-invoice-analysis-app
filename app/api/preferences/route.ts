import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { Pool } from 'pg'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rows = await sql`SELECT * FROM user_preferences WHERE user_id = ${userId} LIMIT 1`
    
    if (rows.length === 0) {
      const created = await sql`
        INSERT INTO user_preferences (
          alert_threshold,
          notify_price_increase,
          notify_opportunities,
          notify_restock_reminders,
          notify_weekly_summary,
          user_id
        )
        VALUES (15, true, true, true, false, ${userId})
        RETURNING *
      `

      return NextResponse.json({
        ...created[0],
      })
    }

    return NextResponse.json(rows[0])
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
    
    const updates = []
    const values = []
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
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const client = await pool.connect()
    await setAppUserId(client, userId)
    const { rows } = await client.query(query, values)
    client.release()
    
    if (rows.length === 0) {
      const insertedFields = ['user_id', ...validFields.filter((key) => data[key] !== undefined)]
      const insertedValues = [userId, ...validFields.filter((key) => data[key] !== undefined).map((key) => data[key])]
      const placeholders = insertedValues.map((_, index) => `$${index + 1}`).join(', ')
      const insertQuery = `
        INSERT INTO user_preferences (${insertedFields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `

      const poolInsert = new Pool({ connectionString: process.env.DATABASE_URL })
      const clientInsert = await poolInsert.connect()
      await setAppUserId(clientInsert, userId)
      const insertResult = await clientInsert.query(insertQuery, insertedValues)
      clientInsert.release()

      return NextResponse.json(insertResult.rows[0])
    }

    return NextResponse.json(rows[0])
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    )
  }
}
