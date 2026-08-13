import type { ExtractedInvoice } from '@/lib/types'
import { normalizeProductName } from '@/lib/invoice-utils'

export type PriceAlertPreferences = {
  threshold: number
  notifyPriceIncrease: boolean
}

export type PriceHistoryEntry = {
  unitPrice: number
  purchaseDate: string | Date
}

export type PriceAlert = {
  productId: number
  dedupeKey: string
  message: string
  data: {
    previous_price: number
    current_price: number
    variation: number
  }
}

export interface PriceAlertRepository {
  getPreferences(): Promise<PriceAlertPreferences>
  getPriceHistory(normalizedName: string): Promise<PriceHistoryEntry[]>
  findProductId(normalizedName: string): Promise<number | null>
  createPriceIncreaseAlert(alert: PriceAlert): Promise<boolean>
}

export type PriceAlertResult = {
  created: number
}

export async function generatePriceAlerts(
  items: ExtractedInvoice['items'],
  repository: PriceAlertRepository,
  context: { sourceInvoiceId: number }
): Promise<PriceAlertResult> {
  const preferences = await repository.getPreferences()
  if (!preferences.notifyPriceIncrease) return { created: 0 }

  let created = 0

  for (const item of items) {
    const normalizedName = normalizeProductName(item.description)
    const history = await repository.getPriceHistory(normalizedName)

    if (history.length < 2) continue

    const previousPrice = Number(history[1].unitPrice)
    const currentPrice = item.unit_price
    const variation = ((currentPrice - previousPrice) / previousPrice) * 100

    if (variation <= preferences.threshold) continue

    const productId = await repository.findProductId(normalizedName)
    if (productId === null) continue

    const wasCreated = await repository.createPriceIncreaseAlert({
      productId,
      dedupeKey: `${context.sourceInvoiceId}:${productId}`,
      message: `${item.description} aumentou ${variation.toFixed(1)}%`,
      data: { previous_price: previousPrice, current_price: currentPrice, variation },
    })
    if (wasCreated) created += 1
  }

  return { created }
}
