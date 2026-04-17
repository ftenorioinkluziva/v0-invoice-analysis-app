import type { ComparableBaseUnit, ComparableMeasurement, ComparablePricing, MeasurementSource } from './types'

type ItemInput = { description: string; quantity: number; unit_price: number; total_price: number }
type ParsedMeasurement = {
  original_quantity: number | null
  original_unit: 'g' | 'kg' | 'ml' | 'L' | null
  comparable_base_unit: ComparableBaseUnit | null
  comparable_quantity_base: number | null
  measurement_source: MeasurementSource
  measurement_confidence: number
}

const STOP_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'a', 'o', 'um', 'uma', 'e', 'com', 'para', 'em', 'un', 'und'])
const UNIT_WORDS = new Set(['kg', 'ml', 'lt', 'g', 'gr', 'pc', 'pct', 'cx'])
const SIMPLE_MEASUREMENT_REGEX = /(\d+[,.]?\d*)\s*(kg|gr|g|ml|lt|l)\b/i
const MULTIPACK_MEASUREMENT_REGEX = /(\d+)\s*[x×]\s*(\d+[,.]?\d*)\s*(kg|gr|g|ml|lt|l)\b/i
const COUNT_WITH_MEASUREMENT_REGEX = /(\d+)\s*(?:un|und|unid|unidades?)\s*(\d+[,.]?\d*)\s*(kg|gr|g|ml|lt|l)\b/i
const COUNT_ONLY_REGEX = /\b(?:cx|caixa|pct|pacote|pc|un|und|unid)\s*\d+\s*(?:un|und|unid|unidades?)?\b/i

export function validateItemPrices(item: ItemInput): ItemInput {
  const { quantity, unit_price, total_price } = item
  if (quantity <= 0 || total_price <= 0) return item

  const calculatedUnit = total_price / quantity
  const tolerance = Math.max(total_price * 0.05, 0.10)

  if (Math.abs(unit_price * quantity - total_price) <= tolerance) return item

  return { ...item, unit_price: Math.round(calculatedUnit * 100) / 100 }
}

export function normalizeProductName(description: string): string {
  const lower = description.toLowerCase()

  const sizeMatch = lower.match(/(\d+[,.]?\d*)\s*(ml|l|g|gr|kg|pc|pct|cx|lt)\b/)
  const size = sizeMatch
    ? sizeMatch[1].replace(',', '.') + sizeMatch[2].replace('gr', 'g')
    : null

  const name = lower
    .replace(/\d+[,.]?\d*\s*(ml|l|g|gr|kg|un|pc|pct|cx|lt)\b/gi, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(w => !STOP_WORDS.has(w) && !UNIT_WORDS.has(w) && w.length > 1)
    .slice(0, 4)
    .join(' ')

  return size ? `${name} ${size}` : name
}

export function categorizeProduct(description: string): string {
  const desc = description.toLowerCase()

  const categories: Record<string, string[]> = {
    'Laticínios': ['leite', 'queijo', 'iogurte', 'manteiga', 'requeijão', 'creme'],
    'Carnes': ['carne', 'frango', 'peixe', 'linguiça', 'salsicha', 'bacon', 'presunto'],
    'Bebidas': ['refrigerante', 'suco', 'água', 'cerveja', 'vinho', 'café'],
    'Limpeza': ['detergente', 'sabão', 'desinfetante', 'alvejante', 'amaciante'],
    'Higiene': ['shampoo', 'sabonete', 'pasta', 'escova', 'papel higiênico'],
    'Grãos': ['arroz', 'feijão', 'lentilha', 'grão de bico', 'ervilha'],
    'Massas': ['macarrão', 'lasanha', 'espaguete', 'penne'],
    'Padaria': ['pão', 'bolo', 'biscoito', 'bolacha'],
    'Hortifruti': ['banana', 'maçã', 'laranja', 'tomate', 'cebola', 'batata', 'alface'],
    'Óleos': ['óleo', 'azeite'],
    'Temperos': ['sal', 'açúcar', 'pimenta', 'alho', 'caldo'],
  }

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => desc.includes(keyword))) {
      return category
    }
  }

  return 'Outros'
}

export function parseComparableMeasurement(description: string): ComparableMeasurement {
  const scaleFallback = createNonComparableMeasurement('description', 0)
  const normalizedDescription = normalizeMeasurementText(description)

  const multipackMatch = normalizedDescription.match(MULTIPACK_MEASUREMENT_REGEX)
  if (multipackMatch) {
    const packCount = parseDecimal(multipackMatch[1])
    const unitQuantity = parseDecimal(multipackMatch[2])
    const unit = normalizeMeasurementUnit(multipackMatch[3])

    if (packCount !== null && unitQuantity !== null && unit) {
      return finalizeMeasurement({
        original_quantity: roundMeasurement(packCount * unitQuantity),
        original_unit: unit,
        comparable_base_unit: toComparableBaseUnit(unit),
        comparable_quantity_base: normalizeToBaseUnit(packCount * unitQuantity, unit),
        measurement_source: 'description',
        measurement_confidence: 0.85,
      })
    }
  }

  const countMeasurementMatch = normalizedDescription.match(COUNT_WITH_MEASUREMENT_REGEX)
  if (countMeasurementMatch) {
    const packCount = parseDecimal(countMeasurementMatch[1])
    const unitQuantity = parseDecimal(countMeasurementMatch[2])
    const unit = normalizeMeasurementUnit(countMeasurementMatch[3])

    if (packCount !== null && unitQuantity !== null && unit) {
      return finalizeMeasurement({
        original_quantity: roundMeasurement(packCount * unitQuantity),
        original_unit: unit,
        comparable_base_unit: toComparableBaseUnit(unit),
        comparable_quantity_base: normalizeToBaseUnit(packCount * unitQuantity, unit),
        measurement_source: 'description',
        measurement_confidence: 0.85,
      })
    }
  }

  const additiveMeasurement = parseAdditiveMeasurement(normalizedDescription)
  if (additiveMeasurement) {
    return finalizeMeasurement({
      ...additiveMeasurement,
      measurement_source: 'description',
      measurement_confidence: 0.85,
    })
  }

  const simpleMatch = normalizedDescription.match(SIMPLE_MEASUREMENT_REGEX)
  if (simpleMatch) {
    const quantity = parseDecimal(simpleMatch[1])
    const unit = normalizeMeasurementUnit(simpleMatch[2])

    if (quantity !== null && unit) {
      return finalizeMeasurement({
        original_quantity: roundMeasurement(quantity),
        original_unit: unit,
        comparable_base_unit: toComparableBaseUnit(unit),
        comparable_quantity_base: normalizeToBaseUnit(quantity, unit),
        measurement_source: 'description',
        measurement_confidence: 0.95,
      })
    }
  }

  if (COUNT_ONLY_REGEX.test(normalizedDescription)) {
    return createNonComparableMeasurement('description', 0.2)
  }

  return scaleFallback
}

export function buildComparableMeasurement(item: ItemInput): ComparableMeasurement {
  const descriptionMeasurement = parseComparableMeasurement(item.description)

  if (!isScaleItem(item)) {
    return descriptionMeasurement
  }

  const originalEvidence = descriptionMeasurement.original_unit && isMassUnit(descriptionMeasurement.original_unit)
    ? {
        original_quantity: descriptionMeasurement.original_quantity,
        original_unit: descriptionMeasurement.original_unit,
      }
    : {
        original_quantity: null,
        original_unit: null,
      }

  return finalizeMeasurement({
    ...originalEvidence,
    comparable_base_unit: 'kg',
    comparable_quantity_base: 1,
    measurement_source: 'scale_item',
    measurement_confidence: 1,
  }, true)
}

export function calculateComparableUnitPrice(item: ItemInput, measurement: ComparableMeasurement): number | null {
  if (!measurement.is_comparable || measurement.comparable_quantity_base === null) {
    return null
  }

  if (measurement.measurement_source === 'scale_item') {
    return roundPrice(item.unit_price)
  }

  const lineQuantity = Number.isInteger(item.quantity) && item.quantity > 1 ? item.quantity : 1
  const denominator = measurement.comparable_quantity_base * lineQuantity

  if (denominator <= 0) {
    return null
  }

  return roundPrice(item.total_price / denominator)
}

export function buildComparablePricing(item: ItemInput): ComparablePricing {
  const measurement = buildComparableMeasurement(item)

  return {
    ...measurement,
    comparable_unit_price: calculateComparableUnitPrice(item, measurement),
  }
}

export function extractUnit(description: string): string | null {
  const match = description.match(/(\d+)\s*(ml|l|g|kg|un|pc|pct|cx|lt)\b/i)
  return match ? `${match[1]}${match[2].toLowerCase()}` : null
}

function parseAdditiveMeasurement(description: string): Omit<ParsedMeasurement, 'measurement_source' | 'measurement_confidence'> | null {
  const parts = description
    .split('+')
    .map(part => part.trim())
    .filter(Boolean)

  if (parts.length < 2) {
    return null
  }

  const parsedParts = parts.map(part => part.match(SIMPLE_MEASUREMENT_REGEX))
  if (parsedParts.some(part => !part)) {
    return null
  }

  const units = parsedParts
    .map(part => normalizeMeasurementUnit(part?.[2] ?? ''))
    .filter((unit): unit is NonNullable<ParsedMeasurement['original_unit']> => unit !== null)

  if (units.length !== parts.length || new Set(units).size !== 1) {
    return null
  }

  const totalQuantity = parsedParts.reduce((sum, part) => {
    const quantity = parseDecimal(part?.[1] ?? '')
    return quantity === null ? sum : sum + quantity
  }, 0)

  const unit = units[0]
  return {
    original_quantity: roundMeasurement(totalQuantity),
    original_unit: unit,
    comparable_base_unit: toComparableBaseUnit(unit),
    comparable_quantity_base: normalizeToBaseUnit(totalQuantity, unit),
  }
}

function finalizeMeasurement(measurement: ParsedMeasurement | Omit<ParsedMeasurement, 'measurement_source' | 'measurement_confidence'> & Pick<ParsedMeasurement, 'measurement_source' | 'measurement_confidence'>, isScaleItem = false): ComparableMeasurement {
  const isComparable = measurement.measurement_confidence >= 0.8 && measurement.comparable_base_unit !== null && measurement.comparable_quantity_base !== null

  return {
    original_quantity: measurement.original_quantity,
    original_unit: measurement.original_unit,
    comparable_base_unit: isComparable ? measurement.comparable_base_unit : null,
    comparable_quantity_base: isComparable ? measurement.comparable_quantity_base : null,
    measurement_source: measurement.measurement_source,
    measurement_confidence: measurement.measurement_confidence,
    is_comparable: isComparable,
    is_scale_item: isScaleItem,
  }
}

function createNonComparableMeasurement(measurementSource: MeasurementSource, measurementConfidence: number): ComparableMeasurement {
  return {
    original_quantity: null,
    original_unit: null,
    comparable_base_unit: null,
    comparable_quantity_base: null,
    measurement_source: measurementSource,
    measurement_confidence: measurementConfidence,
    is_comparable: false,
    is_scale_item: false,
  }
}

function normalizeMeasurementText(description: string): string {
  return description
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s*[+]+\s*/g, ' + ')
    .replace(/\s*[x×]\s*/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseDecimal(value: string): number | null {
  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeMeasurementUnit(unit: string): ParsedMeasurement['original_unit'] {
  const normalized = unit.toLowerCase()

  if (normalized === 'gr' || normalized === 'g') return 'g'
  if (normalized === 'kg') return 'kg'
  if (normalized === 'ml') return 'ml'
  if (normalized === 'l' || normalized === 'lt') return 'L'

  return null
}

function toComparableBaseUnit(unit: NonNullable<ParsedMeasurement['original_unit']>): ComparableBaseUnit {
  return unit === 'g' || unit === 'kg' ? 'kg' : 'L'
}

function normalizeToBaseUnit(quantity: number, unit: NonNullable<ParsedMeasurement['original_unit']>): number {
  if (unit === 'g') return roundMeasurement(quantity / 1000)
  if (unit === 'kg') return roundMeasurement(quantity)
  if (unit === 'ml') return roundMeasurement(quantity / 1000)
  return roundMeasurement(quantity)
}

function roundMeasurement(value: number): number {
  return Math.round(value * 1000) / 1000
}

function roundPrice(value: number): number {
  return Math.round(value * 10000) / 10000
}

function isScaleItem(item: ItemInput): boolean {
  if (item.quantity <= 0) {
    return false
  }

  return Math.abs(item.quantity - Math.round(item.quantity)) > 0.0001
}

function isMassUnit(unit: NonNullable<ParsedMeasurement['original_unit']>): unit is 'g' | 'kg' {
  return unit === 'g' || unit === 'kg'
}
