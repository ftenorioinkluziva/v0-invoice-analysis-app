import { describe, expect, it } from 'vitest'
import {
  PRODUCT_GROUP_SUGGESTION_THRESHOLD,
  scoreProductGroupSuggestion,
  shouldSurfaceSuggestionAfterRejection,
} from '../product-group-suggestions'

describe('product group suggestions heuristic', () => {
  it('scores similar products above the suggestion threshold when unit and category align', () => {
    const result = scoreProductGroupSuggestion(
      {
        normalized_name: 'cafe pilao 500g',
        category: 'Bebidas',
        brand: 'Pilao',
        comparable_base_unit: 'kg',
      },
      {
        normalized_name: 'cafe tres coracoes 500g',
        category: 'Bebidas',
        brand: 'Tres Coracoes',
        base_unit: 'kg',
      }
    )

    expect(result).not.toBeNull()
    expect(result?.confidence).toBeGreaterThanOrEqual(PRODUCT_GROUP_SUGGESTION_THRESHOLD)
    expect(result?.reasons).toContain('Unidade base compativel')
    expect(result?.reasons).toContain('Categoria igual')
  })

  it('does not score products with incompatible base units', () => {
    const result = scoreProductGroupSuggestion(
      {
        normalized_name: 'leite integral 1l',
        category: 'Laticínios',
        brand: 'Marca Boa',
        comparable_base_unit: 'L',
      },
      {
        normalized_name: 'leite integral 1kg',
        category: 'Laticínios',
        brand: 'Marca Boa',
        base_unit: 'kg',
      }
    )

    expect(result).toBeNull()
  })

  it('suppresses a rejected suggestion when nothing material changed and confidence delta is too small', () => {
    const result = shouldSurfaceSuggestionAfterRejection(
      {
        source_product_id: 10,
        target_group_id: 3,
        confidence: 0.8,
        signals_snapshot: {
          normalized_name: 'cafe pilao 500g',
          category: 'Bebidas',
          comparable_base_unit: 'kg',
          comparable_group_id: null,
          target_group_id: 3,
        },
      },
      {
        normalized_name: 'cafe pilao 500g',
        category: 'Bebidas',
        comparable_base_unit: 'kg',
        comparable_group_id: null,
      },
      3,
      0.9
    )

    expect(result).toBe(false)
  })

  it('allows a rejected suggestion to reappear after a material product change', () => {
    const result = shouldSurfaceSuggestionAfterRejection(
      {
        source_product_id: 10,
        target_group_id: 3,
        confidence: 0.8,
        signals_snapshot: {
          normalized_name: 'cafe pilao 500g',
          category: 'Bebidas',
          comparable_base_unit: 'kg',
          comparable_group_id: null,
          target_group_id: 3,
        },
      },
      {
        normalized_name: 'cafe pilao extra forte 500g',
        category: 'Bebidas',
        comparable_base_unit: 'kg',
        comparable_group_id: null,
      },
      3,
      0.81
    )

    expect(result).toBe(true)
  })
})
