'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardStats } from '@/lib/types'

type PriceAlertsProps = {
  priceIncreases: DashboardStats['top_price_increases']
  isLoading?: boolean
}

export function PriceAlerts({ priceIncreases, isLoading }: PriceAlertsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-destructive" />
            Atenção nos preços
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-secondary/50" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!priceIncreases || priceIncreases.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Preços estáveis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma variação significativa de preço detectada recentemente.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-destructive" />
          Atenção nos preços
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {priceIncreases.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-destructive/5 p-2.5"
            >
              <div className="flex-1 truncate pr-2">
                <p className="truncate text-sm font-medium capitalize">
                  {item.product_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(item.previous_price)} → {formatCurrency(item.current_price)}
                </p>
              </div>
              <span className="type-label flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                <TrendingUp className="h-3 w-3" />
                +{item.price_variation.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
