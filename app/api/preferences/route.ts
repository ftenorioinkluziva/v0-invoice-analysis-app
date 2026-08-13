import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { UpdatePreferencesSchema } from '@/lib/validations'
import { createPgPreferencesRepository } from '@/lib/preferences-repository'
import { getPreferences, updatePreferences } from '@/lib/preferences'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preference = await withUserTransaction(userId, async client =>
      getPreferences(createPgPreferencesRepository(client, userId))
    )

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

    const parsed = UpdatePreferencesSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const preference = await withUserTransaction(userId, async client =>
      updatePreferences(createPgPreferencesRepository(client, userId), parsed.data)
    )

    return NextResponse.json(preference)
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return NextResponse.json(
      { error: 'Failed to update user preferences' },
      { status: 500 }
    )
  }
}
