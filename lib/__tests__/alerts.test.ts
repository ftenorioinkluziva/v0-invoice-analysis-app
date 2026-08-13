import { describe, expect, it, vi } from 'vitest'
import { listAlerts, markAlertRead } from '@/lib/alerts'

describe('alerts use cases', () => {
  it('uses a bounded default page size', async () => {
    const repository = {
      listRecent: vi.fn().mockResolvedValue([]),
      updateRead: vi.fn(),
    }

    await listAlerts(repository)

    expect(repository.listRecent).toHaveBeenCalledWith(50)
  })

  it('delegates read-state changes to the tenant repository', async () => {
    const repository = {
      listRecent: vi.fn(),
      updateRead: vi.fn().mockResolvedValue(undefined),
    }

    await markAlertRead(repository, { id: 7, read: true })

    expect(repository.updateRead).toHaveBeenCalledWith({ id: 7, read: true })
  })
})
