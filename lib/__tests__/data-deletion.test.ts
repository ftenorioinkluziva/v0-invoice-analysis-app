import { describe, expect, it, vi } from 'vitest'
import { DataDeletionConfirmationError, deleteAllUserData } from '@/lib/data-deletion'

describe('data deletion use case', () => {
  it('requires the destructive confirmation phrase', async () => {
    const repository = { deleteAllForUser: vi.fn() }

    await expect(deleteAllUserData(repository, { confirmation: 'apagar' }))
      .rejects.toBeInstanceOf(DataDeletionConfirmationError)
    expect(repository.deleteAllForUser).not.toHaveBeenCalled()
  })

  it('normalizes confirmation and delegates the idempotent deletion', async () => {
    const repository = { deleteAllForUser: vi.fn().mockResolvedValue(undefined) }

    await deleteAllUserData(repository, { confirmation: '  Excluir ' })

    expect(repository.deleteAllForUser).toHaveBeenCalledOnce()
  })
})
