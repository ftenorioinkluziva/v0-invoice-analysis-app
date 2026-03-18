'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, X, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ExtractedInvoice } from '@/lib/types'

type UploadStatus = 'idle' | 'uploading' | 'extracting' | 'preview' | 'saving' | 'success' | 'error'

export function PdfUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const handleFileSelect = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF')
      return
    }

    setSelectedFile(file)
    setStatus('extracting')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/extract-pdf', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to extract PDF')
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        setExtractedData(result.data)
        setStatus('preview')
        setShowPreview(true)
      } else {
        throw new Error(result.error || 'Extraction failed')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erro ao processar PDF')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect]
  )

  const handleSave = async () => {
    if (!extractedData || !selectedFile) return

    setStatus('saving')

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: extractedData,
          filename: selectedFile.name,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        if (response.status === 409) {
          throw new Error('Esta nota fiscal já foi importada anteriormente.')
        }
        throw new Error(body?.error || 'Failed to save invoice')
      }

      setStatus('success')
      setShowPreview(false)
      
      setTimeout(() => {
        setStatus('idle')
        setSelectedFile(null)
        setExtractedData(null)
        onSuccess?.()
      }, 2000)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Erro ao salvar nota')
    }
  }

  const handleCancel = () => {
    setShowPreview(false)
    setStatus('idle')
    setSelectedFile(null)
    setExtractedData(null)
    setError(null)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  return (
    <>
      <Card className="border-dashed border-2 border-border bg-card/50">
        <CardContent className="p-4">
          <label
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg p-6 transition-colors hover:bg-secondary/50"
          >
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleInputChange}
              disabled={status !== 'idle'}
            />
            
            {status === 'idle' && (
              <>
                <div className="rounded-full bg-primary/10 p-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Upload de Nota Fiscal</p>
                  <p className="text-sm text-muted-foreground">
                    Arraste um PDF ou toque para selecionar
                  </p>
                </div>
              </>
            )}

            {status === 'extracting' && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="text-center">
                  <p className="font-medium text-foreground">Extraindo dados...</p>
                  <p className="text-sm text-muted-foreground">{selectedFile?.name}</p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="rounded-full bg-success/20 p-3">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <p className="font-medium text-success">Nota salva com sucesso!</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="rounded-full bg-destructive/20 p-3">
                  <X className="h-6 w-6 text-destructive" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-destructive">Erro</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Tentar novamente
                </Button>
              </>
            )}
          </label>
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-md max-h-[90vh] bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Confirmar Dados
            </DialogTitle>
            <DialogDescription>
              Verifique se os dados extraídos estão corretos antes de salvar.
            </DialogDescription>
          </DialogHeader>

          {extractedData && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4 pr-4">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-sm text-muted-foreground">Estabelecimento</p>
                  <p className="font-medium">{extractedData.store_name}</p>
                  {extractedData.store_cnpj && (
                    <p className="text-xs text-muted-foreground">
                      CNPJ: {extractedData.store_cnpj}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 rounded-lg bg-secondary/50 p-3">
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {new Date(extractedData.purchase_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex-1 rounded-lg bg-primary/10 p-3">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-semibold text-primary">
                      {formatCurrency(extractedData.total_amount)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Itens ({extractedData.items.length})
                  </p>
                  <div className="space-y-2">
                    {extractedData.items.slice(0, 10).map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-secondary/30 p-2 text-sm"
                      >
                        <div className="flex-1 truncate pr-2">
                          <p className="truncate">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <p className="font-medium">{formatCurrency(item.total_price)}</p>
                      </div>
                    ))}
                    {extractedData.items.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground">
                        +{extractedData.items.length - 10} itens
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={status === 'saving'}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={status === 'saving'}>
              {status === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar e Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
