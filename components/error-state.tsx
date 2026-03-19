'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function ErrorState({
  message = 'Erro ao carregar dados',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <Card className="bg-card">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <p className="font-medium">{message}</p>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
