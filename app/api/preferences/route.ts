import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { UpdatePreferencesSchema } from '@/lib/validations'
import { createPgPreferencesRepository } from '@/lib/preferences-repository'
import { getPreferences, updatePreferences } from '@/lib/preferences'
import { operationErrorResponse, toOperationError, unauthorizedError, validationError } from '@/lib/operation-error'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const preference = await withUserTransaction(userId, async client =>
      getPreferences(createPgPreferencesRepository(client, userId))
    )

    return Response.json(preference)
  } catch (error) {
    console.error('Failed to fetch user preferences:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PREFERENCES_FETCH_FAILED',
      message: 'Failed to fetch user preferences',
    }))
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return operationErrorResponse(unauthorizedError())
    }

    const parsed = UpdatePreferencesSchema.safeParse(await request.json())
    if (!parsed.success) {
      return operationErrorResponse(
        validationError(
          'INVALID_PREFERENCES_REQUEST',
          'Invalid request',
          parsed.error.issues.map(issue => issue.path.join('.'))
        ),
        { extra: { details: parsed.error.flatten() } }
      )
    }

    if (Object.keys(parsed.data).length === 0) {
      return operationErrorResponse(validationError(
        'NO_PREFERENCE_FIELDS',
        'No valid fields to update'
      ))
    }

    const preference = await withUserTransaction(userId, async client =>
      updatePreferences(createPgPreferencesRepository(client, userId), parsed.data)
    )

    return Response.json(preference)
  } catch (error) {
    console.error('Failed to update user preferences:', error)
    return operationErrorResponse(toOperationError(error, {
      code: 'PREFERENCES_UPDATE_FAILED',
      message: 'Failed to update user preferences',
    }))
  }
}
