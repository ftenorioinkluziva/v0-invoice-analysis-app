'use client'

import useSWR from 'swr'
import {
  Bell,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Repeat,
  Check,
  Trash2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/error-state'
import { fetchJsonWithAuthRedirect, fetchWithAuthRedirect } from '@/lib/client-fetch'
import { cn } from '@/lib/utils'

type Alert = {
  id: number
  alert_type: 'price_increase' | 'opportunity' | 'restock' | 'substitute'
  message: string
  data: {
    previous_price?: number
    current_price?: number
    variation?: number
  } | null
  read: boolean
  created_at: string
  product_name: string
  category: string | null
}

const alertTypeConfig = {
  price_increase: {
    icon: TrendingUp,
    label: 'Alta de Preco',
    color: 'text-destructive',
    bg: 'bg-destructive/10',
  },
  opportunity: {
    icon: TrendingDown,
    label: 'Oportunidade',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  restock: {
    icon: Repeat,
    label: 'Recompra',
    color: 'text-chart-5',
    bg: 'bg-chart-5/10',
  },
  substitute: {
    icon: ShoppingCart,
    label: 'Substituto',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
}

export default function AlertasPage() {
  const { data, error, mutate } = useSWR<{ alerts: Alert[] }>('/api/alerts', fetchJsonWithAuthRedirect)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (hours < 1) return 'Agora'
    if (hours < 24) return `${hours}h atras`
    if (days < 7) return `${days}d atras`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const handleMarkRead = async (id: number) => {
    await fetchWithAuthRedirect('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, read: true }),
    })
    mutate()
  }

  const unreadAlerts = data?.alerts?.filter((a) => !a.read) || []
  const readAlerts = data?.alerts?.filter((a) => a.read) || []

  const groupByDate = (alerts: Alert[]) => {
    const today: Alert[] = []
    const thisWeek: Alert[] = []
    const older: Alert[] = []

    const now = new Date()
    alerts.forEach((alert) => {
      const alertDate = new Date(alert.created_at)
      const diffDays = Math.floor(
        (now.getTime() - alertDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (diffDays < 1) today.push(alert)
      else if (diffDays < 7) thisWeek.push(alert)
      else older.push(alert)
    })

    return { today, thisWeek, older }
  }

  const grouped = groupByDate(unreadAlerts)

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Central de Alertas</h1>
          <p className="text-sm text-muted-foreground">
            {unreadAlerts.length} alertas nao lidos
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1">
          <Bell className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">{unreadAlerts.length}</span>
        </div>
      </header>

      {error ? (
        <ErrorState message="Erro ao carregar alertas" onRetry={() => mutate()} />
      ) : data?.alerts && data.alerts.length > 0 ? (
        <div className="space-y-6">
          {grouped.today.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Hoje</h2>
              <div className="space-y-2">
                {grouped.today.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            </section>
          )}

          {grouped.thisWeek.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Esta Semana</h2>
              <div className="space-y-2">
                {grouped.thisWeek.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            </section>
          )}

          {grouped.older.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Anteriores</h2>
              <div className="space-y-2">
                {grouped.older.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onMarkRead={handleMarkRead}
                  />
                ))}
              </div>
            </section>
          )}

          {readAlerts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                Lidos ({readAlerts.length})
              </h2>
              <div className="space-y-2">
                {readAlerts.slice(0, 5).map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    onMarkRead={handleMarkRead}
                    isRead
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <Card className="bg-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="rounded-full bg-secondary p-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Nenhum alerta</p>
              <p className="text-sm text-muted-foreground">
                Você será notificado sobre variações de preço
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AlertCard({
  alert,
  formatCurrency,
  formatDate,
  onMarkRead,
  isRead = false,
}: {
  alert: Alert
  formatCurrency: (value: number) => string
  formatDate: (date: string) => string
  onMarkRead: (id: number) => void
  isRead?: boolean
}) {
  const config = alertTypeConfig[alert.alert_type]
  const Icon = config.icon

  return (
    <Card className={cn('bg-card', isRead && 'opacity-60')}>
      <CardContent className="p-3">
        <div className="flex gap-3">
          <div className={cn('rounded-lg p-2', config.bg)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <span
                  className={cn(
                    'text-xs font-medium uppercase tracking-wide',
                    config.color
                  )}
                >
                  {config.label}
                </span>
                <p className="mt-0.5 text-sm font-medium capitalize">
                  {alert.product_name}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(alert.created_at)}
              </span>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>

            {alert.data?.previous_price && alert.data?.current_price && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">
                  {formatCurrency(alert.data.previous_price)}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className={cn('font-medium', config.color)}>
                  {formatCurrency(alert.data.current_price)}
                </span>
                {alert.data.variation && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs font-medium',
                      config.bg,
                      config.color
                    )}
                  >
                    {alert.data.variation > 0 ? '+' : ''}
                    {alert.data.variation.toFixed(0)}%
                  </span>
                )}
              </div>
            )}

            {!isRead && (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onMarkRead(alert.id)}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Marcar como lido
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
