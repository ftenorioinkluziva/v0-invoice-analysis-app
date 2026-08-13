import type { UserPreference } from '@/lib/db'

export type PreferencesUpdate = Partial<Pick<
  UserPreference,
  | 'alert_threshold'
  | 'notify_price_increase'
  | 'notify_opportunities'
  | 'notify_restock_reminders'
  | 'notify_weekly_summary'
>>

export interface PreferencesRepository {
  getOrCreate(): Promise<UserPreference>
  update(input: PreferencesUpdate): Promise<UserPreference>
}

export function getPreferences(repository: PreferencesRepository): Promise<UserPreference> {
  return repository.getOrCreate()
}

export function updatePreferences(
  repository: PreferencesRepository,
  input: PreferencesUpdate
): Promise<UserPreference> {
  if (Object.keys(input).length === 0) {
    throw new PreferencesValidationError()
  }

  return repository.update(input)
}

export class PreferencesValidationError extends Error {
  readonly code = 'NO_PREFERENCE_FIELDS'
  readonly category = 'validation' as const
  readonly retryable = false

  constructor() {
    super('At least one preference field is required')
    this.name = 'PreferencesValidationError'
  }
}
