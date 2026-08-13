export type AlertListItem = {
  id: number
  alert_type: 'price_increase' | 'opportunity' | 'restock' | 'substitute'
  message: string
  data: Record<string, unknown> | null
  read: boolean
  created_at: string | Date
  product_name: string
  category: string | null
}

export type UpdateAlertInput = {
  id: number
  read: boolean
}

export interface AlertRepository {
  listRecent(limit: number): Promise<AlertListItem[]>
  updateRead(input: UpdateAlertInput): Promise<void>
}

export async function listAlerts(
  repository: AlertRepository,
  options: { limit?: number } = {}
): Promise<AlertListItem[]> {
  const requestedLimit = options.limit ?? 50
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 50

  return repository.listRecent(limit)
}

export function markAlertRead(
  repository: AlertRepository,
  input: UpdateAlertInput
): Promise<void> {
  return repository.updateRead(input)
}
