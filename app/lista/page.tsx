'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import {
  Plus,
  ShoppingCart,
  Check,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ErrorState } from '@/components/error-state'
import { fetchJsonWithAuthRedirect, fetchWithAuthRedirect } from '@/lib/client-fetch'
import { cn } from '@/lib/utils'

type ShoppingList = {
  id: number
  name: string
  status: string
  created_at: string
  item_count: number
  checked_count: number
  estimated_total: number
}

type ListItem = {
  id: number
  quantity: number
  checked: boolean
  estimated_price: number
  product_id: number
  normalized_name: string
  category: string | null
  last_price: number
  price_variation: number
}

type Suggestion = {
  product_id: number
  normalized_name: string
  category: string | null
  avg_price: number
  days_since_purchase: number
}

type CustomItem = {
  id: string
  name: string
  checked: boolean
}

const MIN_QUANTITY = 1
const UNIT_PRICE_SUFFIX = '/ unidade'

export default function ListaPage() {
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [newListName, setNewListName] = useState('')
  const [showNewListDialog, setShowNewListDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [customItems, setCustomItems] = useState<CustomItem[]>([])
  const quantityUpdateTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    return () => {
      Object.values(quantityUpdateTimers.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])
  const [showFinishDialog, setShowFinishDialog] = useState(false)
  const [isFinishing, setIsFinishing] = useState(false)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customItemQuery, setCustomItemQuery] = useState('')

  const { data: listsData, error: listsError, mutate: mutateLists } = useSWR<{ lists: ShoppingList[] }>(
    '/api/shopping-lists',
    fetchJsonWithAuthRedirect
  )

  const { data: listDetails, error: detailsError, mutate: mutateDetails } = useSWR<{
    list: ShoppingList
    items: ListItem[]
    suggestions: Suggestion[]
  }>(selectedListId ? `/api/shopping-lists/${selectedListId}` : null, fetchJsonWithAuthRedirect)

  const { data: productsData } = useSWR<{
    products: Array<{
      id: number
      normalized_name: string
      category: string | null
      avg_price: number
    }>
  }>(
    debouncedSearchQuery ? `/api/products?search=${encodeURIComponent(debouncedSearchQuery)}` : null,
    fetchJsonWithAuthRedirect
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const handleCreateList = async () => {
    const response = await fetchWithAuthRedirect('/api/shopping-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newListName || 'Nova Lista' }),
    })
    const data = await response.json()
    setNewListName('')
    setShowNewListDialog(false)
    mutateLists()
    if (data.list) {
      setSelectedListId(data.list.id)
    }
  }

  const handleToggleItem = async (itemId: number, checked: boolean) => {
    if (!selectedListId) return
    await fetchWithAuthRedirect(`/api/shopping-lists/${selectedListId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, checked }),
    })
    mutateDetails()
  }

  const handleAddItem = async (productId: number) => {
    if (!selectedListId) return
    await fetchWithAuthRedirect(`/api/shopping-lists/${selectedListId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    })
    setSearchQuery('')
    mutateDetails()
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedListId) return
    await fetchWithAuthRedirect(`/api/shopping-lists/${selectedListId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    })
    mutateDetails()
  }

  const handleAddCustomItem = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setCustomItems((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, name: trimmed, checked: false },
    ])
    setSearchQuery('')
  }

  const handleToggleCustomItem = (id: string, checked: boolean) => {
    setCustomItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked } : item))
    )
  }

  const handleDeleteCustomItem = (id: string) => {
    setCustomItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateQuantity = (itemId: number, quantity: number) => {
    if (!selectedListId) return
    const newQuantity = Math.max(MIN_QUANTITY, quantity)

    mutateDetails((current) => {
      if (!current) return current
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        ),
      }
    }, false)

    const existingTimer = quantityUpdateTimers.current[itemId]
    if (existingTimer) clearTimeout(existingTimer)

    quantityUpdateTimers.current[itemId] = setTimeout(async () => {
      try {
        const response = await fetchWithAuthRedirect(`/api/shopping-lists/${selectedListId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId, quantity: newQuantity }),
        })

        if (!response.ok) {
          throw new Error('Falha ao atualizar quantidade')
        }

        await Promise.all([mutateDetails(), mutateLists()])
      } catch (error) {
        toast.error('Não foi possível atualizar a quantidade.')
        await Promise.all([mutateDetails(), mutateLists()])
      }
    }, 300)
  }

  const handleFinishList = async () => {
    if (!selectedListId) return
    setIsFinishing(true)
    try {
      const res = await fetchWithAuthRedirect(`/api/shopping-lists/${selectedListId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      if (!res.ok) throw new Error('Erro ao finalizar')
      
      toast.success('Lista finalizada com sucesso!')
      setShowFinishDialog(false)
      setSelectedListId(null)
      setCustomItems([])
      mutateLists()
    } catch (error) {
      toast.error('Ocorreu um erro ao finalizar a lista.')
    } finally {
      setIsFinishing(false)
    }
  }

  // Group items by category
  const groupedItems = listDetails?.items.reduce((acc, item) => {
    const category = item.category || 'Outros'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, ListItem[]>)

  const estimatedTotal =
    listDetails?.items.reduce(
      (sum, item) => sum + (item.last_price || item.estimated_price || 0) * item.quantity,
      0
    ) || 0

  const activeLists = listsData?.lists?.filter((l) => l.status === 'active') || []
  const completedLists = listsData?.lists?.filter((l) => l.status === 'completed') || []

  // List view
  if (!selectedListId) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Listas de Compras</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas listas</p>
          </div>
          <Dialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Nova
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card">
              <DialogHeader>
                <DialogTitle>Nova Lista de Compras</DialogTitle>
                <DialogDescription>
                  Crie uma nova lista para organizar suas compras.
                </DialogDescription>
              </DialogHeader>
              <Input
                placeholder="Nome da lista"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewListDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateList}>Criar Lista</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        {listsError ? (
          <ErrorState message="Erro ao carregar listas" onRetry={() => mutateLists()} />
        ) : listsData?.lists && listsData.lists.length > 0 ? (
          <>
            {activeLists.length > 0 ? (
              <div className="space-y-2">
                {activeLists.map((list) => (
                  <Card
                    key={list.id}
                    className="cursor-pointer bg-card transition-colors hover:bg-secondary/50"
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{list.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {list.checked_count || 0}/{list.item_count || 0} itens
                            {list.estimated_total > 0 &&
                              ` • ${formatCurrency(Number(list.estimated_total))}`}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-card">
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                  <div className="rounded-full bg-secondary p-4">
                    <Check className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Nenhuma lista ativa</p>
                    <p className="text-sm text-muted-foreground">
                      Todas as suas compras foram concluídas
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {completedLists.length > 0 && (
              <div className="mt-8">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="completed" className="border-none">
                    <AccordionTrigger className="rounded-lg bg-secondary/30 px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:no-underline">
                      Listas Finalizadas ({completedLists.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pt-2">
                        {completedLists.map((list) => (
                          <Card
                            key={list.id}
                            className="cursor-pointer bg-card/50 transition-colors hover:bg-secondary/50"
                            onClick={() => setSelectedListId(list.id)}
                          >
                            <CardContent className="flex items-center justify-between p-4 opacity-80">
                              <div className="flex items-center gap-3">
                                <div className="rounded-lg bg-secondary p-2">
                                  <Check className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium text-muted-foreground">{list.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {list.checked_count || 0}/{list.item_count || 0} itens
                                    {list.estimated_total > 0 &&
                                      ` • ${formatCurrency(Number(list.estimated_total))}`}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </>
        ) : (
          <Card className="bg-card">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="rounded-full bg-secondary p-4">
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Nenhuma lista criada</p>
                <p className="text-sm text-muted-foreground">
                  Crie sua primeira lista de compras
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  // List detail view
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedListId(null); setCustomItems([]) }}>
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              {listDetails?.list.name || 'Lista'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Estimado: {formatCurrency(estimatedTotal)}
            </p>
          </div>
        </div>
      </header>

      {detailsError && (
        <ErrorState message="Erro ao carregar lista" onRetry={() => mutateDetails()} />
      )}

      {/* Search catalog */}
      <div className="relative">
        <Input
          placeholder="Buscar produto no catálogo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-secondary/50"
        />
        {searchQuery && (
          <Card className="absolute left-0 right-0 top-full z-10 mt-1 bg-card">
            <ScrollArea className="max-h-48">
              <div className="p-2">
                {productsData?.products?.slice(0, 5).map((product) => (
                  <button
                    key={product.id}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-secondary/50"
                    onClick={() => handleAddItem(product.id)}
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">{product.normalized_name}</p>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    </div>
                    <Plus className="h-4 w-4 text-primary" />
                  </button>
                ))}
                {(!productsData?.products || productsData.products.length === 0) && (
                  <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Nenhum produto encontrado no catálogo
                  </p>
                )}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>

      {/* Custom item input */}
      {showCustomInput ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            placeholder="Nome do item avulso..."
            value={customItemQuery}
            onChange={(e) => setCustomItemQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              handleAddCustomItem(customItemQuery)
              setCustomItemQuery('')
              setShowCustomInput(false)
            }}
            className="bg-secondary/50"
          />
          <Button
            size="sm"
            onClick={() => {
              handleAddCustomItem(customItemQuery)
              setCustomItemQuery('')
              setShowCustomInput(false)
            }}
          >
            Adicionar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowCustomInput(false); setCustomItemQuery('') }}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="w-full border-dashed text-muted-foreground"
          onClick={() => setShowCustomInput(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Item avulso (sem histórico)
        </Button>
      )}

      {/* Suggestions */}
      {listDetails?.suggestions && listDetails.suggestions.length > 0 && (
        <Card className="bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              Sugestões de Recompra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {listDetails.suggestions.map((suggestion) => (
                <button
                  key={suggestion.product_id}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                  onClick={() => handleAddItem(suggestion.product_id)}
                >
                  <Plus className="h-3 w-3 text-primary" />
                  <span className="capitalize truncate max-w-40">{suggestion.normalized_name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {suggestion.days_since_purchase}d
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items by category */}
      {groupedItems && Object.keys(groupedItems).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedItems).map(([category, items]) => (
            <div key={category}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <Card key={item.id} className={cn('bg-card', item.checked && 'opacity-60')}>
                    <CardContent className="flex items-center gap-3 p-3">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(checked) =>
                          handleToggleItem(item.id, checked as boolean)
                        }
                        className="h-5 w-5"
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'text-sm font-medium capitalize',
                              item.checked && 'line-through'
                            )}
                          >
                            {item.normalized_name}
                          </p>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= MIN_QUANTITY}
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="min-w-[1.5rem] text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(item.last_price || item.estimated_price || 0)} {UNIT_PRICE_SUFFIX}
                          </span>
                          {item.price_variation !== 0 && (
                            <span
                              className={cn(
                                'flex items-center gap-0.5 text-xs',
                                item.price_variation > 0 ? 'text-destructive' : 'text-success'
                              )}
                            >
                              {item.price_variation > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : item.price_variation < 0 ? (
                                <TrendingDown className="h-3 w-3" />
                              ) : (
                                <Minus className="h-3 w-3" />
                              )}
                              {Math.abs(item.price_variation).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium">
                          {formatCurrency((item.last_price || 0) * item.quantity)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="bg-card">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="rounded-full bg-secondary p-4">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Lista vazia</p>
              <p className="text-sm text-muted-foreground">
                Adicione produtos usando a busca acima
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Custom items */}
      {customItems.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Itens Avulsos</h3>
          <div className="space-y-2">
            {customItems.map((item) => (
              <Card key={item.id} className={cn('bg-card', item.checked && 'opacity-60')}>
                <CardContent className="flex items-center gap-3 p-3">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) =>
                      handleToggleCustomItem(item.id, checked as boolean)
                    }
                    className="h-5 w-5"
                  />
                  <p
                    className={cn(
                      'flex-1 text-sm font-medium',
                      item.checked && 'line-through'
                    )}
                  >
                    {item.name}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteCustomItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Finish shopping button */}
      {(listDetails?.items?.length || customItems.length > 0) && listDetails?.list.status !== 'completed' && (
        <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
          <DialogContent className="bg-card">
            <DialogHeader>
              <DialogTitle>Finalizar Compras</DialogTitle>
              <DialogDescription>
                Tem certeza de que deseja finalizar esta lista? Ela será arquivada e movida para a seção de finalizadas.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowFinishDialog(false)} disabled={isFinishing}>
                Cancelar
              </Button>
              <Button onClick={handleFinishList} disabled={isFinishing}>
                {isFinishing ? 'Finalizando...' : 'Finalizar Lista'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Sticky footer — total + CTA */}
      {listDetails?.list.status !== 'completed' && (listDetails?.items?.length || customItems.length > 0) ? (
        <div className="fixed bottom-20 left-1/2 w-full max-w-lg -translate-x-1/2 px-4 pb-safe">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total estimado</p>
              <p className="font-mono text-base font-bold text-foreground">{formatCurrency(estimatedTotal)}</p>
            </div>
            <Button size="sm" onClick={() => setShowFinishDialog(true)}>
              <Check className="mr-1.5 h-4 w-4" />
              Finalizar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
