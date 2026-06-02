'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardStats } from '@/lib/types'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type SpendingChartProps = {
  data: DashboardStats['spending_by_month']
  isLoading?: boolean
}

const chartColors = {
  axis: 'oklch(0.72 0.015 165)',
  grid: 'oklch(0.32 0.02 165)',
  line: 'oklch(0.78 0.16 165)',
  lineSoft: 'oklch(0.7 0.17 145)',
  tooltipBg: 'oklch(0.12 0.01 165)',
  tooltipBorder: 'oklch(0.34 0.04 165)',
  tooltipText: 'oklch(0.98 0.005 165)',
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
          <CardTitle className="text-base">Evolução de gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-45 animate-pulse rounded bg-secondary/50" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução de gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-45 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Dados insuficientes para exibir gráfico
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
        <CardTitle className="text-base">Evolução de gastos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-45">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="totalSpendWash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.line} stopOpacity={0.34} />
                  <stop offset="42%" stopColor={chartColors.lineSoft} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={chartColors.lineSoft} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke={chartColors.grid}
                strokeDasharray="3 6"
                strokeOpacity={0.55}
              />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: chartColors.axis, fontSize: 11 }}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartColors.tooltipBg,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: '8px',
                  color: chartColors.tooltipText,
                }}
                formatter={(value: number) => [formatCurrency(value), 'Total']}
                labelStyle={{ color: chartColors.axis }}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke={chartColors.line}
                strokeWidth={2.5}
                fill="url(#totalSpendWash)"
                activeDot={{ r: 5, fill: chartColors.line, stroke: chartColors.tooltipBg, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
