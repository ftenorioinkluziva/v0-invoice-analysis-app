import { describe, expect, it } from 'vitest'

import {
  getComparableReferenceLabel,
  getShoppingListItemComparableContext,
  getShoppingListItemTotal,
  getShoppingListItemUnitPrice,
  partitionShoppingListItems,
} from '@/lib/shopping-list'

describe('shopping list helpers', () => {
  it('uses last_price before estimated_price and returns null without fallback price', () => {
    expect(getShoppingListItemUnitPrice({ last_price: 7.49, estimated_price: 6.99 })).toBe(7.49)
    expect(getShoppingListItemUnitPrice({ last_price: null, estimated_price: 6.99 })).toBe(6.99)
    expect(getShoppingListItemUnitPrice({ last_price: null, estimated_price: null })).toBeNull()
  })

  it('computes totals with the same fallback order and falls back to zero', () => {
    expect(getShoppingListItemTotal({ last_price: 8.5, estimated_price: 7.9, quantity: 2 })).toBe(17)
    expect(getShoppingListItemTotal({ last_price: null, estimated_price: 3.25, quantity: 3 })).toBe(9.75)
    expect(getShoppingListItemTotal({ last_price: null, estimated_price: null, quantity: 4 })).toBe(0)
  })

  it('prefers comparable_group_name only when it adds context', () => {
    expect(
      getShoppingListItemComparableContext({
        normalized_name: 'leite integral',
        comparable_group_name: 'Leites',
        comparable_reference_label: 'Referencia em R$/L',
      })
    ).toBe('Leites')

    expect(
      getShoppingListItemComparableContext({
        normalized_name: 'leite integral',
        comparable_group_name: 'Leite Integral',
        comparable_reference_label: 'Referencia em R$/L',
      })
    ).toBe('Referencia em R$/L')

    expect(
      getShoppingListItemComparableContext({
        normalized_name: 'cafe',
        comparable_group_name: null,
        comparable_reference_label: 'Referencia em R$/kg',
      })
    ).toBe('Referencia em R$/kg')
  })

  it('builds the comparable reference label from the base unit', () => {
    expect(getComparableReferenceLabel('kg')).toBe('Referencia em R$/kg')
    expect(getComparableReferenceLabel('L')).toBe('Referencia em R$/L')
    expect(getComparableReferenceLabel(null)).toBeNull()
  })

  it('partitions pending items before checked items without changing their internal order', () => {
    const result = partitionShoppingListItems([
      { id: 1, checked: true },
      { id: 2, checked: false },
      { id: 3, checked: false },
      { id: 4, checked: true },
    ])

    expect(result.pending.map((item) => item.id)).toEqual([2, 3])
    expect(result.checked.map((item) => item.id)).toEqual([1, 4])
  })
})
