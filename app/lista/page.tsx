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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ErrorState } from '@/components/error-state'
import { fetchJsonWithAuthRedirect, fetchWithAuthRedirect } from '@/lib/client-fetch'
import {
  getShoppingListItemComparableContext,
  getShoppingListItemTotal,
  getShoppingListItemUnitPrice,
  partitionShoppingListItems,
  type ShoppingListDetailItem,
} from '@/lib/shopping-list'
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
    items: ShoppingListDetailItem[]
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

  const formatItemUnitPrice = (item: ShoppingListDetailItem) => {
    const unitPrice = getShoppingListItemUnitPrice(item)
    return unitPrice === null ? 'Sem preço' : `${formatCurrency(unitPrice)} ${UNIT_PRICE_SUFFIX}`
  }

  const formatComparableReference = (item: ShoppingListDetailItem) => {
    if (item.comparable_unit_price === null || !item.comparable_base_unit) {
      return null
    }

    return `${formatCurrency(item.comparable_unit_price)}/${item.comparable_base_unit}`
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

  const persistedItems = partitionShoppingListItems(listDetails?.items ?? [])
  const localItems = partitionShoppingListItems(customItems)
  const itemSections = [
    {
      key: 'pending',
      label: null,
      groups: groupItemsByCategory(persistedItems.pending),
      customItems: localItems.pending,
    },
    {
      key: 'checked',
      label: 'Comprados',
      groups: groupItemsByCategory(persistedItems.checked),
      customItems: localItems.checked,
    },
  ].filter((section) => Object.keys(section.groups).length > 0 || section.customItems.length > 0)

  const estimatedTotal =
    listDetails?.items.reduce((sum, item) => sum + getShoppingListItemTotal(item), 0) || 0

  const activeLists = listsData?.lists?.filter((l) => l.status === 'active') || []
  const completedLists = listsData?.lists?.filter((l) => l.status === 'completed') || []

  // List view
  if (!selectedListId) {
    return (
      <div className="flex flex-col gap-5 p-4 md:py-6">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground">Listas de compras</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeLists.length} ativa{activeLists.length === 1 ? '' : 's'}
              {completedLists.length > 0 && `, ${completedLists.length} finalizada${completedLists.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Dialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-10 shrink-0">
                <Plus className="mr-1.5 h-4 w-4" />
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
              <div className="grid gap-2 md:grid-cols-2">
                {activeLists.map((list) => (
                  <Card
                    key={list.id}
                    className="cursor-pointer bg-card p-0 transition-colors hover:bg-secondary/50 focus-within:ring-2 focus-within:ring-ring"
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <CardContent className="flex min-h-20 items-center justify-between gap-3 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{list.name}</p>
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
                            className="cursor-pointer bg-card/50 p-0 transition-colors hover:bg-secondary/50"
                            onClick={() => setSelectedListId(list.id)}
                          >
                            <CardContent className="flex min-h-20 items-center justify-between gap-3 p-3 opacity-80">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="rounded-lg bg-secondary p-2">
                                  <Check className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-medium text-muted-foreground">{list.name}</p>
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

  const hasFooter =
    listDetails?.list.status !== 'completed' &&
    (listDetails?.items?.length || customItems.length > 0)

  // List detail view
  return (
    <div className={cn('flex flex-col gap-4 p-4 md:py-6', hasFooter && 'pb-32 md:pb-28')}>
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => { setSelectedListId(null); setCustomItems([]) }}
            aria-label="Voltar para listas"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-foreground">
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

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
        <div className="space-y-4">
          {/* Search catalog */}
          <div className="relative">
            <Input
              placeholder="Buscar produto no catálogo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 bg-secondary/50"
            />
            {searchQuery && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                <div className="max-h-56 overflow-y-auto overscroll-contain p-1">
                  {productsData?.products?.slice(0, 5).map((product) => (
                    <button
                      key={product.id}
                      className="flex min-h-12 w-full items-center justify-between rounded-lg p-2.5 text-left transition-colors hover:bg-secondary/50"
                      onClick={() => handleAddItem(product.id)}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium capitalize">{product.normalized_name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                      <Plus className="ml-2 h-4 w-4 shrink-0 text-primary" />
                    </button>
                  ))}
                  {(!productsData?.products || productsData.products.length === 0) && (
                    <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                      Nenhum produto encontrado no catálogo
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items by category */}
          {itemSections.length > 0 ? (
            <div className="space-y-6">
              {itemSections.map((section) => (
                <section key={section.key} className="space-y-5">
                  {section.label && (
                    <div className="flex items-center gap-2 pt-1">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {section.label}
                      </h2>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  {Object.entries(section.groups).map(([category, items]) => (
                <div key={category}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{category}</span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <Card
                        key={item.id}
                        className={cn(
                          'bg-card p-0 transition-colors duration-200',
                          item.checked ? 'border-border/60 opacity-60' : 'border-primary/30'
                        )}
                      >
                        <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-start gap-x-2.5 gap-y-1.5 p-2.5 sm:gap-x-3 sm:p-3">
                          <Checkbox
                            checked={item.checked}
                            onCheckedChange={(checked) =>
                              handleToggleItem(item.id, checked as boolean)
                            }
                            className="row-span-2 mt-0.5 h-7 w-7 shrink-0 rounded-md"
                          />

                          <div className="col-start-2 row-start-1 min-w-0">
                            <p
                              className={cn(
                                'line-clamp-2 wrap-break-word text-sm font-semibold capitalize leading-tight transition-all duration-200',
                                item.checked && 'line-through text-muted-foreground'
                              )}
                              title={item.normalized_name}
                            >
                              {item.normalized_name}
                            </p>
                          </div>

                          <div className="col-start-3 row-start-1 flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="outline"
                              size="icon-sm"
                              className="h-8 w-8"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= MIN_QUANTITY}
                              aria-label="Diminuir quantidade"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="min-w-6 text-center font-mono text-sm font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              className="h-8 w-8"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              aria-label="Aumentar quantidade"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="col-start-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.quantity > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  {formatItemUnitPrice(item)}
                                </span>
                              )}
                              {item.price_variation !== 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <span
                                      className={cn(
                                        'inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-semibold',
                                        item.price_variation > 0
                                          ? 'bg-destructive/10 text-destructive'
                                          : 'bg-success/10 text-success'
                                      )}
                                      tabIndex={0}
                                    >
                                      {item.price_variation > 0 ? (
                                        <TrendingUp className="h-3 w-3" />
                                      ) : (
                                        <TrendingDown className="h-3 w-3" />
                                      )}
                                      {Math.abs(item.price_variation).toFixed(0)}%
                                    </span>
                                  </PopoverTrigger>
                                  <PopoverContent side="top" className="w-64 p-3 text-xs">
                                    <p className="font-semibold text-foreground">Variação de preço</p>
                                    <p className="mt-1 text-muted-foreground">
                                      Indica a diferença percentual do preço deste item em relação à última compra registrada. Valores positivos mostram aumento, negativos mostram redução.
                                    </p>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                            {formatComparableReference(item) && (
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="min-w-0 text-xs font-semibold text-foreground">
                                  {getShoppingListItemComparableContext(item)}
                                </span>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="shrink-0 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground">
                                      {formatComparableReference(item)}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent side="top" className="w-64 p-3 text-xs">
                                    <p className="font-semibold text-foreground">Preço de referência do grupo</p>
                                    <p className="mt-1 text-muted-foreground">
                                      Média do preço por {item.comparable_base_unit} de todos os produtos do grupo{' '}
                                      <span className="font-semibold text-foreground">
                                        {item.comparable_group_name}
                                      </span>
                                      {' '}nos últimos 90 dias. Serve para comparar marcas e embalagens diferentes pelo mesmo peso ou volume.
                                    </p>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            )}
                          </div>

                          <div className="col-start-3 row-start-2 flex items-center justify-end gap-2">
                            <span className={cn(
                              'font-mono text-sm font-bold transition-all duration-200 sm:text-base',
                              item.checked && 'text-muted-foreground'
                            )}>
                              {formatCurrency(getShoppingListItemTotal(item))}
                            </span>
                            <button
                              className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:text-destructive"
                              onClick={() => handleDeleteItem(item.id)}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
                  ))}
                  {section.customItems.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                          Itens avulsos
                        </span>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                      <div className="space-y-2">
                        {section.customItems.map((item) => (
                          <Card key={item.id} className={cn('bg-card', item.checked && 'opacity-50')}>
                            <CardContent className="flex items-center gap-3 p-3">
                              <Checkbox
                                checked={item.checked}
                                onCheckedChange={(checked) =>
                                  handleToggleCustomItem(item.id, checked as boolean)
                                }
                                className="h-7 w-7 shrink-0 rounded-md"
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
                                aria-label="Remover item avulso"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
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
        </div>

        <aside className="space-y-3 md:sticky md:top-6">
          {/* Custom item input */}
          {showCustomInput ? (
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-1">
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
                className="h-11 bg-secondary/50"
              />
              <Button
                size="sm"
                className="h-10"
                onClick={() => {
                  handleAddCustomItem(customItemQuery)
                  setCustomItemQuery('')
                  setShowCustomInput(false)
                }}
              >
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" className="h-10" onClick={() => { setShowCustomInput(false); setCustomItemQuery('') }}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-11 w-full border-dashed text-muted-foreground"
              onClick={() => setShowCustomInput(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Item avulso
            </Button>
          )}

          {/* Suggestions */}
          {listDetails?.suggestions && listDetails.suggestions.length > 0 && (
            <Card className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Sugestões de recompra
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {listDetails.suggestions.map((suggestion) => (
                    <button
                      key={suggestion.product_id}
                      className="flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-secondary/20 px-2.5 py-1 text-sm transition-colors hover:border-primary/30 hover:bg-secondary"
                      onClick={() => handleAddItem(suggestion.product_id)}
                    >
                      <Plus className="h-3 w-3 shrink-0 text-primary" />
                      <span className="max-w-44 truncate capitalize">{suggestion.normalized_name}</span>
                      <span className="shrink-0 rounded bg-secondary px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {suggestion.days_since_purchase}d
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

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

      {/* Sticky footer: total + CTA */}
      {listDetails?.list.status !== 'completed' && (listDetails?.items?.length || customItems.length > 0) ? (
        <div className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 px-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] pt-2 md:max-w-5xl md:px-10">
          <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-md">
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

function groupItemsByCategory(items: ShoppingListDetailItem[]) {
  return items.reduce((groups, item) => {
    const category = item.category || 'Outros'
    if (!groups[category]) groups[category] = []
    groups[category].push(item)
    return groups
  }, {} as Record<string, ShoppingListDetailItem[]>)
}
