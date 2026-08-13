import { UpdateAlertSchema } from '@/lib/validations'
import { getSessionUserId } from '@/lib/auth-session'
import { withUserTransaction } from '@/lib/session-sql'
import { createPgAlertRepository } from '@/lib/alert-repository'
import { listAlerts, markAlertRead } from '@/lib/alerts'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alerts = await withUserTransaction(userId, async (client) =>
      listAlerts(createPgAlertRepository(client, userId))
    )
    return Response.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return Response.json({ error: 'Failed to fetch alerts' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = UpdateAlertSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { id, read } = parsed.data

    await withUserTransaction(userId, async (client) =>
      markAlertRead(createPgAlertRepository(client, userId), { id, read })
    )
    
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating alert:', error)
    return Response.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
