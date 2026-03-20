'use client'

import { TrendingUp, TrendingDown, Minus, Receipt, Package } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { DashboardStats } from '@/lib/types'

type StatsCardsProps = {
  stats: DashboardStats | null
  isLoading?: boolean
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-3">
        <Card className="animate-pulse bg-card">
          <CardContent className="p-4">
            <div className="h-20 rounded bg-secondary/50" />
          </CardContent>
        </Card>
        <div className="h-10 animate-pulse rounded-xl bg-card" />
      </div>
    )
  }

  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <div className="space-y-3">
      {/* Main spending card */}
      <Card className="overflow-hidden bg-gradient-to-br from-card to-secondary/30">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground capitalize">{monthName}</p>
              <p className="mt-1 font-mono text-3xl font-bold tracking-tight text-foreground">
                {formatCurrency(stats.total_spent_month)}
              </p>
            </div>
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium ${
                stats.month_variation_percent > 0
                  ? 'bg-destructive/15 text-destructive'
                  : stats.month_variation_percent < 0
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {stats.month_variation_percent > 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : stats.month_variation_percent < 0 ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {formatPercent(stats.month_variation_percent)}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Mes anterior: {formatCurrency(stats.total_spent_last_month)}
          </p>
        </CardContent>
      </Card>

      {/* Secondary stats — compact row */}
      <div className="grid grid-cols-4 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <p
            className={`font-mono text-sm font-semibold leading-none ${
              stats.personal_inflation > 0 ? 'text-destructive' : 'text-success'
            }`}
          >
            {formatPercent(stats.personal_inflation)}
          </p>
          <p className="text-[10px] text-muted-foreground">Inflação</p>
        </div>

        <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
          <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-mono text-sm font-semibold leading-none text-foreground">
            {stats.total_invoices}
          </p>
          <p className="text-[10px] text-muted-foreground">Notas</p>
        </div>

        <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-mono text-sm font-semibold leading-none text-foreground">
            {stats.total_products}
          </p>
          <p className="text-[10px] text-muted-foreground">Produtos</p>
        </div>

        <div className="flex flex-col items-center gap-0.5 px-2 py-2.5">
          <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-mono text-sm font-semibold leading-none text-success">
            {stats.month_variation_percent < 0
              ? formatCurrency(Math.abs(stats.total_spent_month - stats.total_spent_last_month))
              : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground">Economia</p>
        </div>
      </div>
    </div>
  )
}
