import { describe, expect, it, vi } from 'vitest'
import { getDashboardStats } from '@/lib/analytics'

describe('analytics use case', () => {
  it('builds dashboard stats from the repository port', async () => {
    const repository = {
      getMonthSpent: vi.fn()
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(100),
      getCounts: vi.fn().mockResolvedValue({ invoiceCount: 4, productCount: 12 }),
      getSpendingByMonth: vi.fn().mockResolvedValue([{ month: '2026-08', total: 120 }]),
      getTopPriceIncreases: vi.fn().mockResolvedValue([{
        productName: 'tomate',
        priceVariation: 20,
        currentPrice: 12,
        previousPrice: 10,
      }]),
      getPersonalInflation: vi.fn().mockResolvedValue(8.5),
    }

    const stats = await getDashboardStats(
      repository,
      () => new Date('2026-08-13T12:00:00.000Z')
    )

    expect(repository.getMonthSpent).toHaveBeenNthCalledWith(1, '2026-08')
    expect(repository.getMonthSpent).toHaveBeenNthCalledWith(2, '2026-07')
    expect(stats).toEqual({
      total_spent_month: 120,
      total_spent_last_month: 100,
      month_variation_percent: 20,
      total_invoices: 4,
      total_products: 12,
      personal_inflation: 8.5,
      top_price_increases: [{
        product_name: 'tomate',
        price_variation: 20,
        current_price: 12,
        previous_price: 10,
      }],
      spending_by_month: [{ month: '2026-08', total: 120 }],
    })
  })

  it('returns zero month variation when there was no previous spend', async () => {
    const repository = {
      getMonthSpent: vi.fn().mockResolvedValue(10),
      getCounts: vi.fn().mockResolvedValue({ invoiceCount: 1, productCount: 1 }),
      getSpendingByMonth: vi.fn().mockResolvedValue([]),
      getTopPriceIncreases: vi.fn().mockResolvedValue([]),
      getPersonalInflation: vi.fn().mockResolvedValue(0),
    }

    const stats = await getDashboardStats(repository, () => new Date('2026-08-13T12:00:00.000Z'))

    expect(stats.month_variation_percent).toBe(0)
  })
})
