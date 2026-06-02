'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Upload, FileText, Check, Loader2, AlertCircle } from 'lucide-react'
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
import { fetchWithAuthRedirect } from '@/lib/client-fetch'
import { ExtractedInvoice } from '@/lib/types'

type UploadStatus = 'idle' | 'uploading' | 'extracting' | 'preview' | 'saving' | 'success' | 'error'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const SUPPORTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const SUPPORTED_FILE_LABEL = 'PDF, JPG, PNG ou WEBP'
const EXTRACTION_TIMEOUT_MS = 90_000

const formatFileSize = (bytes: number) =>
  new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: bytes >= 1024 * 1024 ? 1 : 0,
  }).format(bytes / 1024 / 1024) + ' MB'

const getUploadErrorMessage = (responseStatus: number, apiError?: string) => {
  if (apiError) return apiError

  switch (responseStatus) {
    case 400:
      return 'Não foi possível ler esse arquivo. Selecione outro PDF ou imagem da nota.'
    case 401:
      return 'Sua sessão expirou. Entre novamente para importar a nota.'
    case 413:
      return 'Arquivo muito grande. Envie uma nota de até 10 MB.'
    case 415:
      return `Formato não aceito. Envie ${SUPPORTED_FILE_LABEL}.`
    case 429:
      return 'Há muitas extrações em andamento. Tente novamente em instantes.'
    case 503:
      return 'A extração está temporariamente indisponível. Tente novamente mais tarde.'
    default:
      return 'Não foi possível extrair os dados agora. Tente novamente.'
  }
}

export function PdfUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedInvoice | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const clearPendingRequest = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    abortControllerRef.current = null
  }

  const validateFile = (file: File) => {
    if (!SUPPORTED_FILE_TYPES.includes(file.type)) {
      return `Formato não aceito. Envie ${SUPPORTED_FILE_LABEL}.`
    }

    if (file.size <= 0) {
      return 'O arquivo está vazio. Selecione outro arquivo.'
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return `Arquivo muito grande (${formatFileSize(file.size)}). Envie uma nota de até 10 MB.`
    }

    return null
  }

  const handleFileSelect = useCallback(async (file: File) => {
    if (status === 'extracting' || status === 'saving') {
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setStatus('error')
      setError(validationError)
      setSelectedFile(null)
      resetInput()
      return
    }

    setSelectedFile(file)
    setStatus('extracting')
    setError(null)
    setExtractedData(null)
    setShowPreview(false)

    try {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      timeoutRef.current = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetchWithAuthRedirect('/api/extract-pdf', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })
      clearPendingRequest()

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(getUploadErrorMessage(response.status, body?.error))
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        setExtractedData(result.data)
        setStatus('preview')
        setShowPreview(true)
      } else {
        throw new Error(result.error || 'A extração não encontrou dados suficientes na nota.')
      }
    } catch (err) {
      clearPendingRequest()
      setStatus('error')
      const isAbort = err instanceof DOMException && err.name === 'AbortError'
      setError(
        isAbort
          ? 'A extração demorou mais que o esperado. Tente novamente ou envie uma imagem mais nítida.'
          : err instanceof Error
            ? err.message
            : 'Erro ao processar a nota.'
      )
    }
  }, [status])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (status === 'extracting' || status === 'saving') {
        return
      }
      const file = e.dataTransfer.files[0]
      if (file) handleFileSelect(file)
    },
    [handleFileSelect, status]
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
    setError(null)

    try {
      const response = await fetchWithAuthRedirect('/api/invoices', {
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
        throw new Error(body?.error || 'Não foi possível salvar a nota. Tente novamente.')
      }

      setStatus('success')
      setShowPreview(false)
      
      setTimeout(() => {
        setStatus('idle')
        setSelectedFile(null)
        setExtractedData(null)
        resetInput()
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
    setIsDragging(false)
    abortControllerRef.current?.abort()
    clearPendingRequest()
    resetInput()
  }

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const formatDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Data não identificada'
    return date.toLocaleDateString('pt-BR')
  }

  const isBusy = status === 'extracting' || status === 'saving'
  const canPickFile = status === 'idle' || status === 'error'

  return (
    <>
      <Card
        className={`border-2 border-dashed bg-card/50 transition-colors ${
          isDragging ? 'border-primary bg-primary/10' : 'border-border'
        }`}
      >
        <CardContent className="p-4">
          <label
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              if (!isBusy) setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`flex flex-col items-center justify-center gap-3 rounded-lg p-6 text-center transition-colors ${
              canPickFile ? 'cursor-pointer hover:bg-secondary/50' : 'cursor-default'
            }`}
            aria-busy={isBusy}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleInputChange}
              disabled={!canPickFile}
            />
            
            {status === 'idle' && (
              <>
                <div className="rounded-full bg-primary/10 p-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Importar nota fiscal</p>
                  <p className="text-sm text-muted-foreground">
                    Arraste ou toque para selecionar {SUPPORTED_FILE_LABEL} até 10 MB.
                  </p>
                </div>
              </>
            )}

            {status === 'extracting' && (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="max-w-full text-center" role="status" aria-live="polite">
                  <p className="font-medium text-foreground">Extraindo dados...</p>
                  <p className="max-w-full truncate text-sm text-muted-foreground">
                    {selectedFile?.name}
                  </p>
                </div>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="rounded-full bg-success/20 p-3">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <p className="font-medium text-success" role="status" aria-live="polite">
                  Nota salva com sucesso!
                </p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="rounded-full bg-destructive/20 p-3">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="max-w-full text-center" role="alert">
                  <p className="font-medium text-destructive">Não foi possível importar</p>
                  <p className="[overflow-wrap:anywhere] text-sm text-muted-foreground">{error}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.preventDefault()
                    handleCancel()
                  }}
                >
                  Tentar novamente
                </Button>
              </>
            )}
          </label>
        </CardContent>
      </Card>

      <Dialog
        open={showPreview}
        onOpenChange={(open) => {
          if (open) {
            setShowPreview(true)
            return
          }

          if (status !== 'saving') {
            handleCancel()
          }
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Confirmar dados
            </DialogTitle>
            <DialogDescription>
              Verifique se os dados extraídos estão corretos antes de salvar.
            </DialogDescription>
          </DialogHeader>

          {extractedData && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4 pr-4">
                <div className="min-w-0 rounded-lg bg-secondary/50 p-3">
                  <p className="text-sm text-muted-foreground">Estabelecimento</p>
                  <p className="[overflow-wrap:anywhere] font-medium">
                    {extractedData.store_name || 'Estabelecimento não identificado'}
                  </p>
                  {extractedData.store_cnpj && (
                    <p className="[overflow-wrap:anywhere] text-xs text-muted-foreground">
                      CNPJ: {extractedData.store_cnpj}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-lg bg-secondary/50 p-3">
                    <p className="text-sm text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {formatDate(extractedData.purchase_date)}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg bg-primary/10 p-3">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="break-words font-semibold text-primary">
                      {formatCurrency(extractedData.total_amount)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-muted-foreground">
                    Itens ({extractedData.items.length})
                  </p>
                  <div className="space-y-2">
                    {extractedData.items.slice(0, 12).map((item, index) => (
                      <div
                        key={index}
                        className="flex min-w-0 items-start justify-between gap-2 rounded-lg bg-secondary/30 p-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 [overflow-wrap:anywhere]">
                            {item.description}
                          </p>
                          <p className="break-words text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unit_price)}
                          </p>
                        </div>
                        <p className="shrink-0 whitespace-nowrap font-medium">
                          {formatCurrency(item.total_price)}
                        </p>
                      </div>
                    ))}
                    {extractedData.items.length > 12 && (
                      <p className="text-center text-sm text-muted-foreground">
                        +{extractedData.items.length - 12} itens
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
                'Confirmar e salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
