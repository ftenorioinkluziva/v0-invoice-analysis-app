'use client'

import { useState } from 'react'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

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

export default function ListaPage() {
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [newListName, setNewListName] = useState('')
  const [showNewListDialog, setShowNewListDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [customItems, setCustomItems] = useState<CustomItem[]>([])

  const { data: listsData, error: listsError, mutate: mutateLists } = useSWR<{ lists: ShoppingList[] }>(
    '/api/shopping-lists',
    fetcher
  )

  const { data: listDetails, error: detailsError, mutate: mutateDetails } = useSWR<{
    list: ShoppingList
    items: ListItem[]
    suggestions: Suggestion[]
  }>(selectedListId ? `/api/shopping-lists/${selectedListId}` : null, fetcher)

  const { data: productsData } = useSWR<{
    products: Array<{
      id: number
      normalized_name: string
      category: string | null
      avg_price: number
    }>
  }>(searchQuery ? `/api/products?search=${encodeURIComponent(searchQuery)}` : null, fetcher)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  const handleCreateList = async () => {
    const response = await fetch('/api/shopping-lists', {
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
    await fetch(`/api/shopping-lists/${selectedListId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId, checked }),
    })
    mutateDetails()
  }

  const handleAddItem = async (productId: number) => {
    if (!selectedListId) return
    await fetch(`/api/shopping-lists/${selectedListId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId }),
    })
    setSearchQuery('')
    mutateDetails()
  }

  const handleDeleteItem = async (itemId: number) => {
    if (!selectedListId) return
    await fetch(`/api/shopping-lists/${selectedListId}`, {
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
          <div className="space-y-2">
            {listsData.lists.map((list) => (
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

      {/* Search and add products */}
      <div className="relative">
        <Input
          placeholder="Buscar ou digitar item avulso..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !searchQuery.trim()) return
            const hasProducts = productsData?.products && productsData.products.length > 0
            if (!hasProducts) handleAddCustomItem(searchQuery)
          }}
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
                <button
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border p-2 text-left transition-colors hover:bg-secondary/50"
                  onClick={() => handleAddCustomItem(searchQuery)}
                >
                  <Plus className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Adicionar &quot;{searchQuery.trim()}&quot;</p>
                    <p className="text-xs text-muted-foreground">Item avulso (sem histórico)</p>
                  </div>
                </button>
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>

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
                      <div className="flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium capitalize',
                            item.checked && 'line-through'
                          )}
                        >
                          {item.normalized_name}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.last_price || 0)}
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
      {(listDetails?.items?.length || customItems.length > 0) && (
        <Button className="mt-2" size="lg">
          <Check className="mr-2 h-4 w-4" />
          Finalizar Compras
        </Button>
      )}
    </div>
  )
}
