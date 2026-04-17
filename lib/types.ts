import { z } from 'zod'

export const ComparableBaseUnitSchema = z.enum(['kg', 'L', 'un'])
export const MeasurementSourceSchema = z.enum(['description', 'scale_item', 'rule_inference'])

export const InvoiceItemSchema = z.object({
  description: z.string().describe('Product description as shown on invoice'),
  quantity: z.number().describe('Quantity purchased'),
  unit_price: z.number().describe('Price per unit in BRL'),
  total_price: z.number().describe('Total price for this item in BRL'),
})

export const ExtractedInvoiceSchema = z.object({
  store_name: z.string().describe('Name of the store/establishment'),
  store_cnpj: z.string().nullable().describe('CNPJ of the store if available'),
  store_address: z.string().nullable().describe('Address of the store if available'),
  invoice_number: z.string().nullable().describe('Invoice number if available'),
  purchase_date: z.string().describe('Date of purchase in YYYY-MM-DD format'),
  items: z.array(InvoiceItemSchema).describe('List of items purchased'),
  total_amount: z.number().describe('Total amount of the invoice in BRL'),
})

export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>
export type ExtractedInvoiceItem = z.infer<typeof InvoiceItemSchema>
export type ComparableBaseUnit = z.infer<typeof ComparableBaseUnitSchema>
export type MeasurementSource = z.infer<typeof MeasurementSourceSchema>

export type ComparableMeasurement = {
  original_quantity: number | null
  original_unit: 'g' | 'kg' | 'ml' | 'L' | 'un' | null
  comparable_base_unit: ComparableBaseUnit | null
  comparable_quantity_base: number | null
  measurement_source: MeasurementSource
  measurement_confidence: number
  is_comparable: boolean
  is_scale_item: boolean
}

export type ComparablePricing = ComparableMeasurement & {
  comparable_unit_price: number | null
}

export type NormalizedInvoiceItem = ExtractedInvoiceItem & ComparablePricing

export type DashboardStats = {
  total_spent_month: number
  total_spent_last_month: number
  month_variation_percent: number
  total_invoices: number
  total_products: number
  personal_inflation: number
  top_price_increases: {
    product_name: string
    price_variation: number
    current_price: number
    previous_price: number
  }[]
  spending_by_month: {
    month: string
    total: number
  }[]
}

export type ProductPriceHistory = {
  product_id: number
  product_name: string
  category: string | null
  brand: string | null
  comparable_base_unit: ComparableBaseUnit | null
  comparable_group: {
    id: number
    display_name: string
    base_unit: ComparableBaseUnit
  } | null
  prices: {
    date: string
    price: number
    store_name: string
    raw_description: string
  }[]
  stats: {
    avg_price: number
    min_price: number
    max_price: number
    price_variation_6m: number
  }
}

export type ProductGroupSuggestion = {
  id: number
  source_product_id: number
  target_group_id: number
  confidence: number
  reasons: string[]
  status: 'pending' | 'accepted' | 'rejected' | 'superseded'
}

export type ComparableGroupSummary = {
  id: number
  display_name: string
  base_unit: ComparableBaseUnit
  comparable_occurrences: number
  min_unit_price: number
  avg_unit_price: number
  max_unit_price: number
}

export type ComparableGroupHistory = {
  id: number
  display_name: string
  base_unit: ComparableBaseUnit
  members: {
    product_id: number
    product_label: string
    brand: string | null
  }[]
  aggregates: {
    min_unit_price: number
    avg_unit_price: number
    max_unit_price: number
  }
  recent_items: {
    invoice_item_id: number
    purchase_date: string
    comparable_unit_price: number
    product_id: number
    product_label: string
  }[]
}
