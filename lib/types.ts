import { z } from 'zod'

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
  prices: {
    date: string
    price: number
    store_name: string
  }[]
  stats: {
    avg_price: number
    min_price: number
    max_price: number
    price_variation_6m: number
  }
}
