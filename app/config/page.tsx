'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import {
  Settings,
  Bell,
  Database,
  Palette,
  Download,
  Trash2,
  ChevronRight,
  Receipt,
  Package,
  FileText,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function ConfigPage() {
  const [priceAlertThreshold, setPriceAlertThreshold] = useState([15])
  const [notifications, setNotifications] = useState({
    priceIncrease: true,
    opportunities: true,
    restockReminders: true,
    weeklySummary: false,
  })

  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: prefs, mutate: mutatePrefs } = useSWR('/api/preferences', fetcher)
  const { data: stats } = useSWR<{
    total_invoices: number
    total_products: number
  }>('/api/analytics', fetcher)

  useEffect(() => {
    if (prefs) {
      setPriceAlertThreshold([Number(prefs.alert_threshold || 15)])
      setNotifications({
        priceIncrease: prefs.notify_price_increase ?? true,
        opportunities: prefs.notify_opportunities ?? true,
        restockReminders: prefs.notify_restock_reminders ?? true,
        weeklySummary: prefs.notify_weekly_summary ?? false,
      })
    }
  }, [prefs])

  const savePreferences = async (updates: Record<string, any>) => {
    try {
      await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      mutatePrefs()
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar configuração')
    }
  }

  const handleExportData = () => {
    // In a real app, this would trigger a CSV export
    alert('Funcionalidade de exportacao sera implementada em breve!')
  }

  const handleDeleteAll = async () => {
    if (deleteConfirmation.toLowerCase() !== 'excluir') return
    
    setIsDeleting(true)
    try {
      const res = await fetch('/api/data', {
        method: 'DELETE',
      })
      
      if (!res.ok) {
        throw new Error('Falha ao excluir dados')
      }
      
      toast.success('Todos os dados foram excluídos com sucesso.')
      setDeleteConfirmation('')
      // Reload page to clear swr cache and state
      window.location.reload()
    } catch (error) {
      console.error(error)
      toast.error('Ocorreu um erro ao excluir os dados.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <header>
        <h1 className="text-xl font-bold text-foreground">Configuracoes</h1>
        <p className="text-sm text-muted-foreground">Personalize o aplicativo</p>
      </header>

      {/* Database stats */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" />
            Dados Armazenados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <Receipt className="mx-auto h-5 w-5 text-primary" />
              <p className="mt-1 font-mono text-lg font-semibold">
                {stats?.total_invoices || 0}
              </p>
              <p className="text-xs text-muted-foreground">Notas</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <Package className="mx-auto h-5 w-5 text-chart-3" />
              <p className="mt-1 font-mono text-lg font-semibold">
                {stats?.total_products || 0}
              </p>
              <p className="text-xs text-muted-foreground">Produtos</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3 text-center">
              <FileText className="mx-auto h-5 w-5 text-chart-4" />
              <p className="mt-1 font-mono text-lg font-semibold">
                {stats?.total_invoices || 0}
              </p>
              <p className="text-xs text-muted-foreground">PDFs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Notificacoes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="price-increase" className="flex-1">
              <p className="font-medium">Alertas de alta de preco</p>
              <p className="text-xs text-muted-foreground">
                Notificar quando um produto subir mais de {priceAlertThreshold[0]}%
              </p>
            </Label>
            <Switch
              id="price-increase"
              checked={notifications.priceIncrease}
              onCheckedChange={(checked) => {
                setNotifications((prev) => ({ ...prev, priceIncrease: checked }))
                savePreferences({ notify_price_increase: checked })
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Limite de alerta: {priceAlertThreshold[0]}%
            </Label>
            <Slider
              value={priceAlertThreshold}
              onValueChange={setPriceAlertThreshold}
              onValueCommit={(value) => savePreferences({ alert_threshold: value[0] })}
              max={50}
              min={5}
              step={5}
              className="py-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="opportunities" className="flex-1">
              <p className="font-medium">Oportunidades de economia</p>
              <p className="text-xs text-muted-foreground">
                Produtos em baixa historica de preco
              </p>
            </Label>
            <Switch
              id="opportunities"
              checked={notifications.opportunities}
              onCheckedChange={(checked) => {
                setNotifications((prev) => ({ ...prev, opportunities: checked }))
                savePreferences({ notify_opportunities: checked })
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="restock" className="flex-1">
              <p className="font-medium">Lembretes de recompra</p>
              <p className="text-xs text-muted-foreground">
                Baseado no ciclo de consumo
              </p>
            </Label>
            <Switch
              id="restock"
              checked={notifications.restockReminders}
              onCheckedChange={(checked) => {
                setNotifications((prev) => ({ ...prev, restockReminders: checked }))
                savePreferences({ notify_restock_reminders: checked })
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="weekly" className="flex-1">
              <p className="font-medium">Resumo semanal</p>
              <p className="text-xs text-muted-foreground">
                Relatorio de gastos e tendencias
              </p>
            </Label>
            <Switch
              id="weekly"
              checked={notifications.weeklySummary}
              onCheckedChange={(checked) => {
                setNotifications((prev) => ({ ...prev, weeklySummary: checked }))
                savePreferences({ notify_weekly_summary: checked })
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4 text-primary" />
            Aparencia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Tema escuro</p>
              <p className="text-xs text-muted-foreground">Sempre ativo</p>
            </div>
            <Switch checked disabled />
          </div>
        </CardContent>
      </Card>

      {/* Data management */}
      <Card className="bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" />
            Gerenciar Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-between"
            onClick={handleExportData}
          >
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Exportar dados (CSV)
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between text-destructive hover:text-destructive"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Limpar todos os dados
                </div>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusao</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      Esta acao ira remover permanentemente todas as notas fiscais,
                      produtos e historico de precos. Esta acao nao pode ser desfeita.
                    </p>
                    <div className="space-y-2 pt-2">
                      <Label htmlFor="confirm-delete">
                        Digite <strong className="text-foreground">excluir</strong> para confirmar:
                      </Label>
                      <Input
                        id="confirm-delete"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="excluir"
                        className="border-destructive/50 focus-visible:ring-destructive text-foreground"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmation('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteConfirmation.toLowerCase() !== 'excluir' || isDeleting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteAll();
                  }}
                >
                  {isDeleting ? 'Excluindo...' : 'Excluir tudo'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* App info */}
      <Card className="bg-card">
        <CardContent className="p-4 text-center">
          <p className="font-semibold text-foreground">NoteWise</p>
          <p className="text-xs text-muted-foreground">Versao 1.0.0</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Analise inteligente de notas fiscais
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
