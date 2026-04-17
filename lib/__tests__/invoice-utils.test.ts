import { describe, it, expect } from 'vitest'
import {
  normalizeProductName,
  categorizeProduct,
  validateItemPrices,
  extractUnit,
  parseComparableMeasurement,
  buildComparableMeasurement,
  calculateComparableUnitPrice,
  buildComparablePricing,
} from '../invoice-utils'

describe('normalizeProductName', () => {
  it('should lowercase and take first 4 meaningful words', () => {
    expect(normalizeProductName('ARROZ BRANCO TIPO 1 CAMIL'))
      .toBe('arroz branco tipo camil')
  })

  it('should remove stop words', () => {
    expect(normalizeProductName('Leite de Vaca Integral'))
      .toBe('leite vaca integral')
  })

  it('should preserve size+unit as product identity', () => {
    expect(normalizeProductName('Coca Cola 2lt'))
      .toBe('coca cola 2lt')
  })

  it('should normalize gr to g', () => {
    expect(normalizeProductName('Café Pilão 500gr'))
      .toBe('café pilão 500g')
  })

  it('should handle comma decimal in size', () => {
    expect(normalizeProductName('Queijo Mussarela 1,03kg'))
      .toBe('queijo mussarela 1.03kg')
  })

  it('should replace dashes with spaces', () => {
    expect(normalizeProductName('Suco—Natural–Laranja'))
      .toBe('suco natural laranja')
  })

  it('should strip unit tokens from word list', () => {
    expect(normalizeProductName('Farinha kg Trigo'))
      .toBe('farinha trigo')
  })

  it('should handle descriptions with only stop/unit words gracefully', () => {
    const result = normalizeProductName('de da do')
    expect(result).toBe('')
  })

  it('should handle ml units', () => {
    expect(normalizeProductName('Água Mineral 500ml'))
      .toBe('água mineral 500ml')
  })
})

describe('categorizeProduct', () => {
  it('should categorize dairy products', () => {
    expect(categorizeProduct('Leite Integral 1L')).toBe('Laticínios')
    expect(categorizeProduct('Queijo Prato Fatiado')).toBe('Laticínios')
    expect(categorizeProduct('Iogurte Natural')).toBe('Laticínios')
  })

  it('should categorize meat products', () => {
    expect(categorizeProduct('Carne Bovina Moída')).toBe('Carnes')
    expect(categorizeProduct('Peito de Frango')).toBe('Carnes')
    expect(categorizeProduct('Linguiça Toscana')).toBe('Carnes')
  })

  it('should categorize beverages', () => {
    expect(categorizeProduct('Refrigerante Cola 2L')).toBe('Bebidas')
    expect(categorizeProduct('Suco de Laranja')).toBe('Bebidas')
    expect(categorizeProduct('Café Torrado')).toBe('Bebidas')
  })

  it('should categorize cleaning products', () => {
    expect(categorizeProduct('Detergente Líquido')).toBe('Limpeza')
    expect(categorizeProduct('Sabão em Pó')).toBe('Limpeza')
  })

  it('should categorize grains', () => {
    expect(categorizeProduct('Arroz Tipo 1')).toBe('Grãos')
    expect(categorizeProduct('Feijão Carioca')).toBe('Grãos')
  })

  it('should categorize produce', () => {
    expect(categorizeProduct('Banana Prata')).toBe('Hortifruti')
    expect(categorizeProduct('Tomate Italiano')).toBe('Hortifruti')
  })

  it('should return Outros for unknown items', () => {
    expect(categorizeProduct('Fita Adesiva Transparente')).toBe('Outros')
    expect(categorizeProduct('Pilha AA')).toBe('Outros')
  })

  it('should be case-insensitive', () => {
    expect(categorizeProduct('LEITE INTEGRAL')).toBe('Laticínios')
    expect(categorizeProduct('arroz branco')).toBe('Grãos')
  })
})

describe('validateItemPrices', () => {
  it('should return item unchanged when prices are consistent', () => {
    const item = { description: 'Arroz', quantity: 2, unit_price: 10, total_price: 20 }
    expect(validateItemPrices(item)).toEqual(item)
  })

  it('should recalculate unit_price when mismatched', () => {
    const item = { description: 'Arroz', quantity: 3, unit_price: 99, total_price: 30 }
    const result = validateItemPrices(item)
    expect(result.unit_price).toBe(10)
    expect(result.total_price).toBe(30)
  })

  it('should return item unchanged when quantity is zero', () => {
    const item = { description: 'X', quantity: 0, unit_price: 5, total_price: 10 }
    expect(validateItemPrices(item)).toEqual(item)
  })

  it('should return item unchanged when total_price is zero', () => {
    const item = { description: 'X', quantity: 2, unit_price: 5, total_price: 0 }
    expect(validateItemPrices(item)).toEqual(item)
  })

  it('should tolerate small rounding differences (within 5%)', () => {
    const item = { description: 'Banana', quantity: 1.234, unit_price: 5.99, total_price: 7.39 }
    const result = validateItemPrices(item)
    expect(result.unit_price).toBe(5.99)
  })

  it('should fix unit_price when difference exceeds tolerance', () => {
    const item = { description: 'Leite', quantity: 2, unit_price: 100, total_price: 10 }
    const result = validateItemPrices(item)
    expect(result.unit_price).toBe(5)
  })

  it('should preserve description when recalculating', () => {
    const item = { description: 'Café Premium', quantity: 4, unit_price: 0, total_price: 40 }
    const result = validateItemPrices(item)
    expect(result.description).toBe('Café Premium')
    expect(result.unit_price).toBe(10)
  })
})

describe('extractUnit', () => {
  it('should extract ml unit', () => {
    expect(extractUnit('Água Mineral 500ml')).toBe('500ml')
  })

  it('should extract kg unit', () => {
    expect(extractUnit('Arroz 5kg')).toBe('5kg')
  })

  it('should extract l unit', () => {
    expect(extractUnit('Leite 1l')).toBe('1l')
  })

  it('should extract un unit', () => {
    expect(extractUnit('Ovos 12un')).toBe('12un')
  })

  it('should be case-insensitive', () => {
    expect(extractUnit('AGUA 500ML')).toBe('500ml')
  })

  it('should return null when no unit found', () => {
    expect(extractUnit('Biscoito Cream Cracker')).toBeNull()
  })

  it('should return null for empty string', () => {
    expect(extractUnit('')).toBeNull()
  })

  it('should extract first match when multiple present', () => {
    expect(extractUnit('Suco 200ml Pack 6un')).toBe('200ml')
  })
})

describe('parseComparableMeasurement', () => {
  it('should parse simple gram measurement', () => {
    expect(parseComparableMeasurement('Creme de leite 200g')).toEqual({
      original_quantity: 200,
      original_unit: 'g',
      comparable_base_unit: 'kg',
      comparable_quantity_base: 0.2,
      measurement_source: 'description',
      measurement_confidence: 0.95,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should parse simple liter measurement with comma decimal', () => {
    expect(parseComparableMeasurement('Suco integral 1,5L')).toEqual({
      original_quantity: 1.5,
      original_unit: 'L',
      comparable_base_unit: 'L',
      comparable_quantity_base: 1.5,
      measurement_source: 'description',
      measurement_confidence: 0.95,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should parse multipack with x separator', () => {
    expect(parseComparableMeasurement('Bebida láctea 2x90g')).toEqual({
      original_quantity: 180,
      original_unit: 'g',
      comparable_base_unit: 'kg',
      comparable_quantity_base: 0.18,
      measurement_source: 'description',
      measurement_confidence: 0.85,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should parse count plus measurement pattern', () => {
    expect(parseComparableMeasurement('Iogurte 2 un 90g')).toEqual({
      original_quantity: 180,
      original_unit: 'g',
      comparable_base_unit: 'kg',
      comparable_quantity_base: 0.18,
      measurement_source: 'description',
      measurement_confidence: 0.85,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should parse additive volume pattern', () => {
    expect(parseComparableMeasurement('Suco 500ml + 100ml')).toEqual({
      original_quantity: 600,
      original_unit: 'ml',
      comparable_base_unit: 'L',
      comparable_quantity_base: 0.6,
      measurement_source: 'description',
      measurement_confidence: 0.85,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should parse OCR noisy decimals in kilograms', () => {
    expect(parseComparableMeasurement('Tomate 0,680kg')).toEqual({
      original_quantity: 0.68,
      original_unit: 'kg',
      comparable_base_unit: 'kg',
      comparable_quantity_base: 0.68,
      measurement_source: 'description',
      measurement_confidence: 0.95,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should parse unit count as comparable per unit', () => {
    expect(parseComparableMeasurement('cx 12 un')).toEqual({
      original_quantity: 12,
      original_unit: 'un',
      comparable_base_unit: 'un',
      comparable_quantity_base: 12,
      measurement_source: 'description',
      measurement_confidence: 0.85,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should keep count-only packages without unit count as non comparable', () => {
    expect(parseComparableMeasurement('caixa biscoito pacote')).toEqual({
      original_quantity: null,
      original_unit: null,
      comparable_base_unit: null,
      comparable_quantity_base: null,
      measurement_source: 'description',
      measurement_confidence: 0.2,
      is_comparable: false,
      is_scale_item: false,
    })
  })

  it('should mark missing measurement as non comparable', () => {
    expect(parseComparableMeasurement('Biscoito cream cracker')).toEqual({
      original_quantity: null,
      original_unit: null,
      comparable_base_unit: null,
      comparable_quantity_base: null,
      measurement_source: 'description',
      measurement_confidence: 0,
      is_comparable: false,
      is_scale_item: false,
    })
  })
})

describe('buildComparableMeasurement', () => {
  it('should prioritize scale item over description parsing', () => {
    expect(buildComparableMeasurement({
      description: 'Tomate 0,680kg',
      quantity: 0.68,
      unit_price: 12.9,
      total_price: 8.77,
    })).toEqual({
      original_quantity: 0.68,
      original_unit: 'kg',
      comparable_base_unit: 'kg',
      comparable_quantity_base: 1,
      measurement_source: 'scale_item',
      measurement_confidence: 1,
      is_comparable: true,
      is_scale_item: true,
    })
  })

  it('should expose scale item without inventing packaging evidence', () => {
    expect(buildComparableMeasurement({
      description: 'Banana nanica',
      quantity: 1.234,
      unit_price: 5.99,
      total_price: 7.39,
    })).toEqual({
      original_quantity: null,
      original_unit: null,
      comparable_base_unit: 'kg',
      comparable_quantity_base: 1,
      measurement_source: 'scale_item',
      measurement_confidence: 1,
      is_comparable: true,
      is_scale_item: true,
    })
  })

  it('should keep packaged items from description parsing', () => {
    expect(buildComparableMeasurement({
      description: 'Leite integral 1L',
      quantity: 2,
      unit_price: 6.49,
      total_price: 12.98,
    })).toEqual({
      original_quantity: 1,
      original_unit: 'L',
      comparable_base_unit: 'L',
      comparable_quantity_base: 1,
      measurement_source: 'description',
      measurement_confidence: 0.95,
      is_comparable: true,
      is_scale_item: false,
    })
  })
})

describe('calculateComparableUnitPrice', () => {
  it('should reuse unit_price for scale items', () => {
    const item = {
      description: 'Tomate 0,680kg',
      quantity: 0.68,
      unit_price: 12.9,
      total_price: 8.77,
    }

    expect(calculateComparableUnitPrice(item, buildComparableMeasurement(item))).toBe(12.9)
  })

  it('should divide by line quantity for repeated packaged items', () => {
    const item = {
      description: 'Leite integral 1L',
      quantity: 2,
      unit_price: 6.49,
      total_price: 12.98,
    }

    expect(calculateComparableUnitPrice(item, buildComparableMeasurement(item))).toBe(6.49)
  })

  it('should keep multipack embedded in comparable quantity base', () => {
    const item = {
      description: 'Bebida láctea 2x90g',
      quantity: 1,
      unit_price: 4.5,
      total_price: 4.5,
    }

    expect(buildComparablePricing(item)).toEqual({
      original_quantity: 180,
      original_unit: 'g',
      comparable_base_unit: 'kg',
      comparable_quantity_base: 0.18,
      comparable_unit_price: 25,
      measurement_source: 'description',
      measurement_confidence: 0.85,
      is_comparable: true,
      is_scale_item: false,
    })
  })

  it('should return null for non-comparable items', () => {
    const item = {
      description: 'Biscoito cream cracker',
      quantity: 1,
      unit_price: 4.99,
      total_price: 4.99,
    }

    expect(calculateComparableUnitPrice(item, buildComparableMeasurement(item))).toBeNull()
  })
})
