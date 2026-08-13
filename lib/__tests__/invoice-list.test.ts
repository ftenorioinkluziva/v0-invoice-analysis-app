import { describe, expect, it, vi } from 'vitest'
import { listInvoices } from '@/lib/invoice-list'

describe('invoice list use case', () => {
  it('uses the default bounded page size', async () => {
    const repository = {
      listRecent: vi.fn().mockResolvedValue([]),
    }

    await listInvoices(repository)

    expect(repository.listRecent).toHaveBeenCalledWith(50)
  })

  it('clamps explicit limits to the supported range', async () => {
    const repository = {
      listRecent: vi.fn().mockResolvedValue([]),
    }

    await listInvoices(repository, { limit: 500 })
    expect(repository.listRecent).toHaveBeenLastCalledWith(100)

    await listInvoices(repository, { limit: 0 })
    expect(repository.listRecent).toHaveBeenLastCalledWith(1)
  })
})
