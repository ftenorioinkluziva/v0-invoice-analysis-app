import { neon } from '@neondatabase/serverless'

export const sql = neon(process.env.DATABASE_URL!)

export type Store = {
  id: number
  cnpj: string | null
  name: string
  address: string | null
  created_at: Date
}

export type Product = {
  id: number
  normalized_name: string
  category: string | null
  brand: string | null
  unit: string | null
  created_at: Date
}

export type Invoice = {
  id: number
  store_id: number
  invoice_number: string | null
  purchase_date: Date
  total_amount: number
  pdf_filename: string | null
  processed_at: Date
}

export type InvoiceItem = {
  id: number
  invoice_id: number
  product_id: number
  raw_description: string
  quantity: number
  unit_price: number
  total_price: number
}

export type ShoppingList = {
  id: number
  name: string
  created_at: Date
  status: 'active' | 'completed' | 'archived'
}

export type ShoppingListItem = {
  id: number
  list_id: number
  product_id: number
  quantity: number
  checked: boolean
  estimated_price: number | null
}

export type Alert = {
  id: number
  product_id: number
  alert_type: 'price_increase' | 'opportunity' | 'restock' | 'substitute'
  message: string
  data: Record<string, unknown> | null
  read: boolean
  created_at: Date
}
