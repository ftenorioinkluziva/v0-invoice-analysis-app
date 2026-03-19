'use client'

import useSWR from 'swr'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/error-state'
import { PdfUpload } from '@/components/pdf-upload'
import { StatsCards } from '@/components/stats-cards'
import { PriceAlerts } from '@/components/price-alerts'
import { SpendingChart } from '@/components/spending-chart'
import { RecentInvoices } from '@/components/recent-invoices'
import { DashboardStats } from '@/lib/types'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function HomePage() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    mutate: mutateStats,
  } = useSWR<DashboardStats>('/api/analytics', fetcher)

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    error: invoicesError,
    mutate: mutateInvoices,
  } = useSWR<{ invoices: Array<{
    id: number
    invoice_number: string | null
    purchase_date: string
    total_amount: number
    pdf_filename: string | null
    store_name: string
    item_count: number
  }> }>('/api/invoices', fetcher)

  const handleRefresh = () => {
    mutateStats()
    mutateInvoices()
  }

  const handleUploadSuccess = () => {
    mutateStats()
    mutateInvoices()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">NoteWise</h1>
          <p className="text-sm text-muted-foreground">Analise de Notas Fiscais</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-5 w-5" />
          <span className="sr-only">Atualizar dados</span>
        </Button>
      </header>

      {/* Error state */}
      {(statsError || invoicesError) && (
        <ErrorState
          message="Erro ao carregar dados do dashboard"
          onRetry={handleRefresh}
        />
      )}

      {/* Stats */}
      <StatsCards stats={stats ?? null} isLoading={statsLoading} />

      {/* Upload */}
      <PdfUpload onSuccess={handleUploadSuccess} />

      {/* Spending Chart */}
      <SpendingChart
        data={stats?.spending_by_month ?? []}
        isLoading={statsLoading}
      />

      {/* Price Alerts */}
      <PriceAlerts
        priceIncreases={stats?.top_price_increases ?? []}
        isLoading={statsLoading}
      />

      {/* Recent Invoices */}
      <RecentInvoices
        invoices={invoicesData?.invoices ?? []}
        isLoading={invoicesLoading}
      />
    </div>
  )
}
