import { describe, expect, it, vi } from 'vitest'
import { generatePriceAlerts, type PriceAlertRepository } from '@/lib/price-alerts'

const items = [
  { description: 'Leite integral 1L', quantity: 1, unit_price: 8, total_price: 8 },
]

function createRepository(overrides: Partial<PriceAlertRepository> = {}): PriceAlertRepository {
  return {
    getPreferences: vi.fn().mockResolvedValue({ threshold: 15, notifyPriceIncrease: true }),
    getPriceHistory: vi.fn().mockResolvedValue([
      { unitPrice: 8, purchaseDate: '2026-08-12' },
      { unitPrice: 6, purchaseDate: '2026-08-01' },
    ]),
    findProductId: vi.fn().mockResolvedValue(10),
    createPriceIncreaseAlert: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('price alert use case', () => {
  it('creates an alert when the current price exceeds the configured threshold', async () => {
    const repository = createRepository()

    const result = await generatePriceAlerts(items, repository)

    expect(result).toEqual({ created: 1 })
    expect(repository.createPriceIncreaseAlert).toHaveBeenCalledWith({
      productId: 10,
      message: 'Leite integral 1L aumentou 33.3%',
      data: { previous_price: 6, current_price: 8, variation: expect.closeTo(33.333333, 5) },
    })
  })

  it('does not write when notifications are disabled', async () => {
    const repository = createRepository({
      getPreferences: vi.fn().mockResolvedValue({ threshold: 1, notifyPriceIncrease: false }),
    })

    await expect(generatePriceAlerts(items, repository)).resolves.toEqual({ created: 0 })
    expect(repository.getPriceHistory).not.toHaveBeenCalled()
    expect(repository.createPriceIncreaseAlert).not.toHaveBeenCalled()
  })

  it('does not write when there is no prior price or no product', async () => {
    const noHistory = createRepository({ getPriceHistory: vi.fn().mockResolvedValue([]) })
    const noProduct = createRepository({ findProductId: vi.fn().mockResolvedValue(null) })

    await expect(generatePriceAlerts(items, noHistory)).resolves.toEqual({ created: 0 })
    await expect(generatePriceAlerts(items, noProduct)).resolves.toEqual({ created: 0 })
    expect(noProduct.createPriceIncreaseAlert).not.toHaveBeenCalled()
  })
})
