type ItemInput = { description: string; quantity: number; unit_price: number; total_price: number }

const STOP_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'a', 'o', 'um', 'uma', 'e', 'com', 'para', 'em', 'un', 'und'])
const UNIT_WORDS = new Set(['kg', 'ml', 'lt', 'g', 'gr', 'pc', 'pct', 'cx'])

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

export function extractUnit(description: string): string | null {
  const match = description.match(/(\d+)\s*(ml|l|g|kg|un|pc|pct|cx|lt)\b/i)
  return match ? `${match[1]}${match[2].toLowerCase()}` : null
}
