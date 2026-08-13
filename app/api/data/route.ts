import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { DeleteAllDataSchema } from '@/lib/validations'
import { createPgUserDataDeletionRepository } from '@/lib/data-deletion-repository'
import { deleteAllUserData } from '@/lib/data-deletion'

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return Response.json({ error: 'Confirmation required' }, { status: 400 })
    }

    const parsed = DeleteAllDataSchema.safeParse(payload)
    if (!parsed.success) {
      return Response.json(
        { error: 'Confirmation required', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await withUserTransaction(userId, async client =>
      deleteAllUserData(
        createPgUserDataDeletionRepository(client, userId),
        parsed.data
      )
    )

    return Response.json({ success: true, message: 'User data deleted successfully' })
  } catch (error) {
    console.error('Error deleting all data:', error)
    return Response.json({ error: 'Failed to delete data' }, { status: 500 })
  }
}
