'use client'

import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Invoice = {
  id: number
  invoice_number: string | null
  purchase_date: string
  total_amount: number
  pdf_filename: string | null
  store_name: string
  item_count: number
}

type RecentInvoicesProps = {
  invoices: Invoice[]
  isLoading?: boolean
}

export function RecentInvoices({ invoices, isLoading }: RecentInvoicesProps) {
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

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Notas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded bg-secondary/50" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Notas Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma nota fiscal cadastrada ainda.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Notas Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {invoices.slice(0, 5).map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg bg-secondary/30 p-2.5"
            >
              <div className="flex-1 truncate pr-2">
                <p className="truncate text-sm font-medium">{invoice.store_name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(invoice.purchase_date)} • {invoice.item_count} itens
                </p>
              </div>
              <span className="font-mono text-sm font-semibold text-primary">
                {formatCurrency(invoice.total_amount)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
