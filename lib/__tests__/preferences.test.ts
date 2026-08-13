import { describe, expect, it, vi } from 'vitest'
import { getPreferences, updatePreferences, PreferencesValidationError } from '@/lib/preferences'

describe('preferences use cases', () => {
  it('delegates reading preferences to the repository', async () => {
    const preference = { id: 1, alert_threshold: 15 }
    const repository = { getOrCreate: vi.fn().mockResolvedValue(preference), update: vi.fn() }

    await expect(getPreferences(repository)).resolves.toBe(preference)
    expect(repository.getOrCreate).toHaveBeenCalledOnce()
  })

  it('rejects empty updates before reaching the repository', async () => {
    const repository = { getOrCreate: vi.fn(), update: vi.fn() }

    expect(() => updatePreferences(repository, {})).toThrow(PreferencesValidationError)
    expect(repository.update).not.toHaveBeenCalled()
  })

  it('delegates validated updates to the repository', async () => {
    const repository = {
      getOrCreate: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: 1, alert_threshold: 20 }),
    }

    await updatePreferences(repository, { alert_threshold: 20 })

    expect(repository.update).toHaveBeenCalledWith({ alert_threshold: 20 })
  })
})
