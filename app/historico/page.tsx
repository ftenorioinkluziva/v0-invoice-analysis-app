'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  BarChart3,
  Store,
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
import { ProductPriceHistory } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

type Product = {
  id: number
  normalized_name: string
  category: string | null
  avg_price: number
  purchase_count: number
  last_purchase: string
}

export default function HistoricoPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)

  const { data: productsData, error: productsError, mutate: mutateProducts } = useSWR<{
    products: Product[]
    categories: string[]
  }>(
    `/api/products?search=${encodeURIComponent(searchQuery)}&category=${encodeURIComponent(
      selectedCategory
    )}`,
    fetcher
  )

  const { data: productHistory } = useSWR<ProductPriceHistory>(
    selectedProductId ? `/api/products/${selectedProductId}` : null,
    fetcher
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    })
  }

  // Product detail view
  if (selectedProductId && productHistory) {
    const chartData = [...productHistory.prices]
      .reverse()
      .map((p) => ({
        date: formatDate(p.date),
        price: p.price,
      }))

    return (
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedProductId(null)}
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-lg font-bold capitalize text-foreground">
              {productHistory.product_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {productHistory.category || 'Sem categoria'}
            </p>
          </div>
        </header>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Preco Medio</p>
              <p className="font-mono text-lg font-semibold text-foreground">
                {formatCurrency(productHistory.stats.avg_price)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Variacao 6 meses</p>
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
              <p className="text-xs text-muted-foreground">Menor Preco</p>
              <p className="font-mono text-lg font-semibold text-success">
                {formatCurrency(productHistory.stats.min_price)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">Maior Preco</p>
              <p className="font-mono text-lg font-semibold text-destructive">
                {formatCurrency(productHistory.stats.max_price)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Price chart */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-primary" />
              Historico de Precos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 1 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="oklch(0.78 0.16 165)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="oklch(0.78 0.16 165)"
                          stopOpacity={0}
                        />
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
                <p className="text-sm text-muted-foreground">
                  Dados insuficientes para grafico
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Price by store */}
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4 text-primary" />
              Precos por Estabelecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {productHistory.prices.slice(0, 10).map((price, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{price.raw_description}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Store className="h-3 w-3 shrink-0" />
                      <span className="truncate">{price.store_name}</span>
                      <span>·</span>
                      <span className="shrink-0">{formatDate(price.date)}</span>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold">
                    {formatCurrency(price.price)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Product list view
  return (
    <div className="flex flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-bold text-foreground">Historico de Precos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a variacao de precos
        </p>
      </header>

      {/* Search and filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar produto..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-secondary/50 pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[130px] bg-secondary/50">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {productsData?.categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products list */}
      <ScrollArea className="flex-1">
        {productsError ? (
          <ErrorState message="Erro ao carregar produtos" onRetry={() => mutateProducts()} />
        ) : productsData?.products && productsData.products.length > 0 ? (
          <div className="space-y-2">
            {productsData.products.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer bg-card transition-colors hover:bg-secondary/50"
                onClick={() => setSelectedProductId(product.id)}
              >
                <CardContent className="flex items-center justify-between p-3">
                  <div className="flex-1">
                    <p className="font-medium capitalize">{product.normalized_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{product.category || 'Outros'}</span>
                      <span>•</span>
                      <span>{product.purchase_count} compras</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">
                      {formatCurrency(product.avg_price)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-card">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-secondary p-4">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Nenhum produto encontrado</p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Tente uma busca diferente'
                    : 'Adicione notas fiscais para ver produtos'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </ScrollArea>
    </div>
  )
}
