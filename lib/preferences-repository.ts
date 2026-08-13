import type { PoolClient } from 'pg'
import type { UserPreference } from '@/lib/db'
import type { PreferencesRepository, PreferencesUpdate } from '@/lib/preferences'

const preferenceFields = [
  'alert_threshold',
  'notify_price_increase',
  'notify_opportunities',
  'notify_restock_reminders',
  'notify_weekly_summary',
] as const

export function createPgPreferencesRepository(
  client: PoolClient,
  userId: string
): PreferencesRepository {
  return {
    async getOrCreate() {
      const existing = await client.query(
        'SELECT * FROM user_preferences WHERE user_id = $1 LIMIT 1',
        [userId]
      )
      if (existing.rows.length > 0) return existing.rows[0] as UserPreference

      const created = await client.query(`
        INSERT INTO user_preferences (
          alert_threshold, notify_price_increase, notify_opportunities,
          notify_restock_reminders, notify_weekly_summary, user_id
        ) VALUES (15, true, true, true, false, $1)
        RETURNING *
      `, [userId])

      return created.rows[0] as UserPreference
    },

    async update(input: PreferencesUpdate) {
      const updates: string[] = []
      const values: unknown[] = []

      for (const field of preferenceFields) {
        if (input[field] !== undefined) {
          updates.push(`${field} = $${values.length + 1}`)
          values.push(input[field])
        }
      }

      updates.push('updated_at = CURRENT_TIMESTAMP')
      const userPlaceholder = values.length + 1
      const updated = await client.query(`
        UPDATE user_preferences
        SET ${updates.join(', ')}
        WHERE user_id = $${userPlaceholder}
        RETURNING *
      `, [...values, userId])
      if (updated.rows.length > 0) return updated.rows[0] as UserPreference

      const insertedFields = ['user_id', ...preferenceFields.filter(field => input[field] !== undefined)]
      const insertedValues = [userId, ...preferenceFields
        .filter(field => input[field] !== undefined)
        .map(field => input[field])]
      const placeholders = insertedValues.map((_, index) => `$${index + 1}`).join(', ')
      const inserted = await client.query(`
        INSERT INTO user_preferences (${insertedFields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `, insertedValues)

      return inserted.rows[0] as UserPreference
    },
  }
}
