import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { Pool } from '@neondatabase/serverless'

export async function GET() {
  try {
    const rows = await sql`SELECT * FROM user_preferences WHERE id = 1`
    
    if (rows.length === 0) {
      return NextResponse.json({
        id: 1,
        alert_threshold: 15,
        notify_price_increase: true,
        notify_opportunities: true,
        notify_restock_reminders: true,
        notify_weekly_summary: false,
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
      WHERE id = 1 
      RETURNING *
    `
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    const { rows } = await pool.query(query, values)
    await pool.end()
    
    if (rows.length === 0) {
        return NextResponse.json({ error: 'Preferences not found' }, { status: 404 })
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
