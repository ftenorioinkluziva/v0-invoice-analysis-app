'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import {
  Search,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronRight,
  BarChart3,
  Store,
  Package,
  Scale,
  CalendarRange,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ErrorState } from '@/components/error-state'
import { ComparableGroupHistory, ComparableGroupSummary, ProductPriceHistory } from '@/lib/types'
import { fetchJsonWithAuthRedirect } from '@/lib/client-fetch'

type Product = {
  id: number
  normalized_name: string
  category: string | null
  avg_price: number
  purchase_count: number
  last_purchase: string
}

type ProductsResponse = {
  products: Product[]
  categories: string[]
}

type ComparableGroupsResponse = {
  groups: ComparableGroupSummary[]
}

type ViewMode = 'products' | 'comparable'
type PeriodDays = '30' | '90' | '180'

const PERIOD_OPTIONS: { value: PeriodDays; label: string }[] = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
]

export default function HistoricoPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('products')
  const [periodDays, setPeriodDays] = useState<PeriodDays>('90')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [quickFilter, setQuickFilter] = useState<'all' | 'expensive' | 'frequent'>('all')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const categoryParam = selectedCategory === 'all' ? '' : selectedCategory
  const productsUrl = `/api/products?search=${encodeURIComponent(debouncedSearchQuery)}&category=${encodeURIComponent(categoryParam)}&period_days=${periodDays}`
  const comparableGroupsUrl = `/api/product-groups?view=comparable&search=${encodeURIComponent(debouncedSearchQuery)}&period_days=${periodDays}`

  const {
    data: productsData,
    error: productsError,
    mutate: mutateProducts,
  } = useSWR<ProductsResponse>(viewMode === 'products' ? productsUrl : null, fetchJsonWithAuthRedirect)

  const {
    data: comparableGroupsData,
    error: comparableGroupsError,
    mutate: mutateComparableGroups,
  } = useSWR<ComparableGroupsResponse>(
    viewMode === 'comparable' ? comparableGroupsUrl : null,
    fetchJsonWithAuthRedirect
  )

  const {
    data: productHistory,
    error: productHistoryError,
    mutate: mutateProductHistory,
  } = useSWR<ProductPriceHistory>(
    selectedProductId ? `/api/products/${selectedProductId}?period_days=${periodDays}` : null,
    fetchJsonWithAuthRedirect
  )

  const {
    data: comparableGroupHistory,
    error: comparableGroupHistoryError,
    mutate: mutateComparableGroupHistory,
  } = useSWR<ComparableGroupHistory>(
    selectedGroupId ? `/api/product-groups/${selectedGroupId}/history?period_days=${periodDays}` : null,
    fetchJsonWithAuthRedirect
  )

  const displayedProducts = (() => {
    const list = productsData?.products ?? []

    if (quickFilter === 'expensive') {
      return [...list].sort((firstProduct, secondProduct) => secondProduct.avg_price - firstProduct.avg_price)
    }

    if (quickFilter === 'frequent') {
      return [...list].sort(
        (firstProduct, secondProduct) => secondProduct.purchase_count - firstProduct.purchase_count
      )
    }

    return list
  })()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatUnitPrice = (value: number, unit: string) => {
    return `${formatCurrency(value)}/${unit}`
  }

  const formatShortDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    })
  }

  const formatFullDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  if (selectedProductId) {
    if (productHistoryError) {
      return <ErrorState message="Erro ao carregar historico do produto" onRetry={() => mutateProductHistory()} />
    }

    if (!productHistory) {
      return null
    }

    const chartData = [...productHistory.prices]
      .reverse()
      .map((pricePoint) => ({
        date: formatShortDate(pricePoint.date),
        price: pricePoint.price,
      }))

    return (
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedProductId(null)}>
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-lg font-bold capitalize text-foreground">{productHistory.product_name}</h1>
            <p className="text-sm text-muted-foreground">{productHistory.category || 'Sem categoria'}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Preco medio</p>
              <p className="font-mono text-lg font-semibold text-foreground">
                {formatCurrency(productHistory.stats.avg_price)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Variacao do periodo</p>
              <p
                className={cn(
                  'flex items-center gap-1 font-mono text-lg font-semibold',
                  productHistory.stats.price_variation_6m > 0
                    ? 'text-destructive'
                    : productHistory.stats.price_variation_6m < 0
                      ? 'text-success'
                      : 'text-foreground'
                )}
              >
                {productHistory.stats.price_variation_6m > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : productHistory.stats.price_variation_6m < 0 ? (
                  <TrendingDown className="h-4 w-4" />
                ) : (
                  <Minus className="h-4 w-4" />
                )}
                {productHistory.stats.price_variation_6m > 0 ? '+' : ''}
                {productHistory.stats.price_variation_6m.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Menor preco</p>
              <p className="font-mono text-lg font-semibold text-success">
                {formatCurrency(productHistory.stats.min_price)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Maior preco</p>
              <p className="font-mono text-lg font-semibold text-destructive">
                {formatCurrency(productHistory.stats.max_price)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Historico de precos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 1 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.78 0.16 165)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.78 0.16 165)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'oklch(0.65 0 0)', fontSize: 11 }}
                      tickFormatter={(value) => `R$${value.toFixed(0)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'oklch(0.12 0 0)',
                        border: '1px solid oklch(0.22 0 0)',
                        borderRadius: '8px',
                        color: 'oklch(0.98 0 0)',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Preco']}
                      labelStyle={{ color: 'oklch(0.65 0 0)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="oklch(0.78 0.16 165)"
                      strokeWidth={2}
                      fill="url(#colorPrice)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center">
                <p className="text-sm text-muted-foreground">Dados insuficientes para grafico</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-muted-foreground" />
              Precos por estabelecimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.values(
              productHistory.prices.reduce<
                Record<string, { store: string; min: number; max: number; sum: number; count: number }>
              >((accumulator, pricePoint) => {
                const key = pricePoint.store_name
                if (!accumulator[key]) {
                  accumulator[key] = {
                    store: pricePoint.store_name,
                    min: pricePoint.price,
                    max: pricePoint.price,
                    sum: pricePoint.price,
                    count: 1,
                  }
                } else {
                  accumulator[key].min = Math.min(accumulator[key].min, pricePoint.price)
                  accumulator[key].max = Math.max(accumulator[key].max, pricePoint.price)
                  accumulator[key].sum += pricePoint.price
                  accumulator[key].count += 1
                }

                return accumulator
              }, {})
            ).map((row) => (
              <div key={row.store} className="rounded-lg bg-secondary/30 p-3">
                <p className="truncate text-sm font-medium">{row.store}</p>
                <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="font-mono text-sm font-semibold text-success">{formatCurrency(row.min)}</p>
                    <p className="text-[10px] text-muted-foreground">Minimo</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatCurrency(row.sum / row.count)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Media</p>
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-destructive">{formatCurrency(row.max)}</p>
                    <p className="text-[10px] text-muted-foreground">Maximo</p>
                  </div>
                </div>
                <p className="mt-1 text-right text-[10px] text-muted-foreground">
                  {row.count} compra{row.count !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (selectedGroupId) {
    if (comparableGroupHistoryError) {
      return <ErrorState message="Erro ao carregar comparavel" onRetry={() => mutateComparableGroupHistory()} />
    }

    if (!comparableGroupHistory) {
      return null
    }

    return (
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedGroupId(null)}>
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">{comparableGroupHistory.display_name}</h1>
            <p className="text-sm text-muted-foreground">Referencia em R$/{comparableGroupHistory.base_unit}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            label="Menor"
            value={formatUnitPrice(comparableGroupHistory.aggregates.min_unit_price, comparableGroupHistory.base_unit)}
            valueClassName="text-success"
          />
          <MetricCard
            label="Media"
            value={formatUnitPrice(comparableGroupHistory.aggregates.avg_unit_price, comparableGroupHistory.base_unit)}
          />
          <MetricCard
            label="Maior"
            value={formatUnitPrice(comparableGroupHistory.aggregates.max_unit_price, comparableGroupHistory.base_unit)}
            valueClassName="text-destructive"
          />
        </div>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-muted-foreground" />
              SKUs do grupo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {comparableGroupHistory.members.map((member) => (
              <div key={member.product_id} className="rounded-lg bg-secondary/30 p-3">
                <p className="text-sm font-medium text-foreground">{member.product_label}</p>
                <p className="text-xs text-muted-foreground">{member.brand || 'Sem marca'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              Ultimas ocorrencias comparaveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {comparableGroupHistory.recent_items.length > 0 ? (
              comparableGroupHistory.recent_items.map((item) => (
                <div key={item.invoice_item_id} className="rounded-lg bg-secondary/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.product_label}</p>
                      <p className="text-xs text-muted-foreground">{formatFullDate(item.purchase_date)}</p>
                    </div>
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatUnitPrice(item.comparable_unit_price, comparableGroupHistory.base_unit)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma ocorrencia comparavel no periodo.</p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeListError = viewMode === 'products' ? productsError : comparableGroupsError
  const retryActiveList = viewMode === 'products' ? mutateProducts : mutateComparableGroups
  const comparableGroups = comparableGroupsData?.groups ?? []

  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Historico de Precos</h1>
        <p className="text-sm text-muted-foreground">Compare produtos e grupos no periodo selecionado</p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setViewMode('products')}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            viewMode === 'products'
              ? 'bg-secondary text-foreground'
              : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
          )}
        >
          Produtos
        </button>
        <button
          onClick={() => setViewMode('comparable')}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            viewMode === 'comparable'
              ? 'bg-secondary text-foreground'
              : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
          )}
        >
          Comparaveis
        </button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={viewMode === 'products' ? 'Buscar produto...' : 'Buscar grupo comparavel...'}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="bg-secondary/50 pl-9"
          />
        </div>

        <Select value={periodDays} onValueChange={(value) => setPeriodDays(value as PeriodDays)}>
          <SelectTrigger className="w-full bg-secondary/50 sm:w-[140px]">
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {viewMode === 'products' ? (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full bg-secondary/50 sm:w-[150px]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {productsData?.categories?.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {viewMode === 'products' ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setQuickFilter('all')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              quickFilter === 'all'
                ? 'bg-secondary text-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setQuickFilter('expensive')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              quickFilter === 'expensive'
                ? 'bg-secondary text-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            )}
          >
            Mais caros
          </button>
          <button
            onClick={() => setQuickFilter('frequent')}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
              quickFilter === 'frequent'
                ? 'bg-secondary text-foreground'
                : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
            )}
          >
            Mais comprados
          </button>
        </div>
      ) : null}

      <ScrollArea className="flex-1">
        {activeListError ? (
          <ErrorState
            message={viewMode === 'products' ? 'Erro ao carregar produtos' : 'Erro ao carregar comparaveis'}
            onRetry={() => retryActiveList()}
          />
        ) : viewMode === 'products' ? (
          displayedProducts.length > 0 ? (
            <div className="space-y-2">
              {displayedProducts.map((product) => (
                <Card
                  key={product.id}
                  className="cursor-pointer bg-card transition-colors hover:bg-secondary/50"
                  onClick={() => setSelectedProductId(product.id)}
                >
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium capitalize">{product.normalized_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{product.category || 'Outros'}</span>
                        <span>•</span>
                        <span>{product.purchase_count} compras</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {formatCurrency(product.avg_price)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyHistoryState
              title="Nenhum produto encontrado"
              description={searchQuery ? 'Tente uma busca diferente' : 'Nenhum produto com compras no periodo selecionado'}
            />
          )
        ) : comparableGroups.length > 0 ? (
          <div className="space-y-2">
            {comparableGroups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer bg-card transition-colors hover:bg-secondary/50"
                onClick={() => setSelectedGroupId(group.id)}
              >
                <CardContent className="space-y-3 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{group.display_name}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Scale className="h-3.5 w-3.5" />
                        <span>Referencia em R$/{group.base_unit}</span>
                      </div>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <ComparableMetric label="Menor" value={formatUnitPrice(group.min_unit_price, group.base_unit)} valueClassName="text-success" />
                    <ComparableMetric label="Media" value={formatUnitPrice(group.avg_unit_price, group.base_unit)} />
                    <ComparableMetric label="Maior" value={formatUnitPrice(group.max_unit_price, group.base_unit)} valueClassName="text-destructive" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyHistoryState
            title="Nenhum comparavel encontrado"
            description={searchQuery ? 'Tente uma busca diferente' : 'Nenhum grupo com ocorrencias comparaveis no periodo selecionado'}
          />
        )}
      </ScrollArea>
    </div>
  )
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <Card className="bg-card">
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('font-mono text-lg font-semibold text-foreground', valueClassName)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function ComparableMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg bg-secondary/30 p-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-mono text-xs font-semibold text-foreground sm:text-sm', valueClassName)}>{value}</p>
    </div>
  )
}

function EmptyHistoryState({ title, description }: { title: string; description: string }) {
  return (
    <Card className="bg-card">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="rounded-full bg-secondary p-4">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}
