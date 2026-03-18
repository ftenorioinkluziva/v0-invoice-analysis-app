'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardStats } from '@/lib/types'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SpendingChartProps = {
  data: DashboardStats['spending_by_month']
  isLoading?: boolean
}

export function SpendingChart({ data, isLoading }: SpendingChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-')
    const date = new Date(Number(year), Number(m) - 1)
    const label = date.toLocaleDateString('pt-BR', { month: 'short' })
    return data && data.length > 6 ? `${label}/${year.slice(2)}` : label
  }

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolucao de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] animate-pulse rounded bg-secondary/50" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolucao de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Dados insuficientes para exibir grafico
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const chartData = data.map((item) => ({
    month: formatMonth(item.month),
    total: item.total,
  }))

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evolucao de Gastos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.78 0.16 165)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.78 0.16 165)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'oklch(0.12 0 0)',
                  border: '1px solid oklch(0.22 0 0)',
                  borderRadius: '8px',
                  color: 'oklch(0.98 0 0)',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Total']}
                labelStyle={{ color: 'oklch(0.65 0 0)' }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="oklch(0.78 0.16 165)"
                strokeWidth={2}
                fill="url(#colorTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
