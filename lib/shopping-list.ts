import type { ComparableBaseUnit } from '@/lib/types'

export type ShoppingListDetailItem = {
  id: number
  quantity: number
  checked: boolean
  estimated_price: number | null
  product_id: number
  normalized_name: string
  category: string | null
  last_price: number | null
  previous_price: number | null
  price_variation: number
  comparable_unit_price: number | null
  comparable_base_unit: ComparableBaseUnit | null
  comparable_reference_label: string | null
  comparable_group_name: string | null
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function getComparableReferenceLabel(baseUnit: ComparableBaseUnit | null): string | null {
  return baseUnit ? `Referencia em R$/${baseUnit}` : null
}

export function getShoppingListItemUnitPrice(item: Pick<ShoppingListDetailItem, 'last_price' | 'estimated_price'>) {
  return item.last_price ?? item.estimated_price ?? null
}

export function getShoppingListItemTotal(
  item: Pick<ShoppingListDetailItem, 'last_price' | 'estimated_price' | 'quantity'>
) {
  return (getShoppingListItemUnitPrice(item) ?? 0) * item.quantity
}

export function getShoppingListItemComparableContext(
  item: Pick<
    ShoppingListDetailItem,
    'normalized_name' | 'comparable_group_name' | 'comparable_reference_label'
  >
) {
  const groupName = item.comparable_group_name?.trim()
  const normalizedName = item.normalized_name.trim().toLocaleLowerCase('pt-BR')

  if (groupName && groupName.toLocaleLowerCase('pt-BR') !== normalizedName) {
    return groupName
  }

  return item.comparable_reference_label
}
