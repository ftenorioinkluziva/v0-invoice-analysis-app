import type { PoolClient, QueryResultRow } from 'pg'
import { getPool } from '@/lib/db-pool'

function queryTemplate(
  query: (text: string, values: unknown[]) => Promise<{ rows: QueryResultRow[] }>,
  strings: TemplateStringsArray,
  values: unknown[]
): Promise<QueryResultRow[]> {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
    ''
  )
  return query(text, values).then((r) => r.rows)
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): Promise<QueryResultRow[]> {
  return queryTemplate((text, params) => getPool().query(text, params), strings, values)
}

export function sqlForClient(client: PoolClient) {
  return (strings: TemplateStringsArray, ...values: unknown[]) =>
    queryTemplate((text, params) => client.query(text, params), strings, values)
}

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
  comparable_group_id: number | null
  created_at: Date
}

export type ProductGroup = {
  id: number
  user_id: string
  display_name: string
  base_unit: 'kg' | 'L' | 'un'
  created_at: Date
  updated_at: Date
}

export type ProductGroupMembershipEvent = {
  id: number
  product_id: number
  group_id: number
  user_id: string
  event_type: 'associate' | 'disassociate'
  changed_by: string
  created_at: Date
}

export type ProductGroupSuggestion = {
  id: number
  user_id: string
  source_product_id: number
  target_group_id: number
  confidence: number
  reasons: string[]
  status: 'pending' | 'accepted' | 'rejected' | 'superseded'
  signals_snapshot: Record<string, unknown>
  decision_at: Date | null
  changed_by: string
  change_origin: 'heuristic' | 'recompute' | 'accept' | 'reject'
  created_at: Date
  updated_at: Date
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
  comparable_base_unit: 'kg' | 'L' | 'un' | null
  comparable_quantity_base: number | null
  comparable_unit_price: number | null
  measurement_source: 'description' | 'scale_item' | 'rule_inference' | null
  measurement_confidence: number | null
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

export type UserPreference = {
  id: number
  alert_threshold: number
  notify_price_increase: boolean
  notify_opportunities: boolean
  notify_restock_reminders: boolean
  notify_weekly_summary: boolean
  updated_at: Date
}
