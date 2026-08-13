import type { DashboardStats } from '@/lib/types'

export type SpendingByMonth = {
  month: string
  total: number
}

export type PriceIncrease = {
  productName: string
  priceVariation: number
  currentPrice: number
  previousPrice: number
}

export type AnalyticsCounts = {
  invoiceCount: number
  productCount: number
}

export interface AnalyticsRepository {
  getMonthSpent(month: string): Promise<number>
  getCounts(): Promise<AnalyticsCounts>
  getSpendingByMonth(): Promise<SpendingByMonth[]>
  getTopPriceIncreases(): Promise<PriceIncrease[]>
  getPersonalInflation(): Promise<number>
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7)
}

export async function getDashboardStats(
  repository: AnalyticsRepository,
  clock: () => Date = () => new Date()
): Promise<DashboardStats> {
  const now = clock()
  const currentMonth = monthKey(now)
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))

  const totalThisMonth = await repository.getMonthSpent(currentMonth)
  const totalLastMonth = await repository.getMonthSpent(lastMonth)
  const counts = await repository.getCounts()
  const spendingByMonth = await repository.getSpendingByMonth()
  const priceIncreases = await repository.getTopPriceIncreases()
  const personalInflation = await repository.getPersonalInflation()

  return {
    total_spent_month: totalThisMonth,
    total_spent_last_month: totalLastMonth,
    month_variation_percent: totalLastMonth > 0
      ? ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
      : 0,
    total_invoices: counts.invoiceCount,
    total_products: counts.productCount,
    personal_inflation: personalInflation || 0,
    top_price_increases: priceIncreases.map(item => ({
      product_name: item.productName,
      price_variation: item.priceVariation,
      current_price: item.currentPrice,
      previous_price: item.previousPrice,
    })),
    spending_by_month: spendingByMonth,
  }
}
