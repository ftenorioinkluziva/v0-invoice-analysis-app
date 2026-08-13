import { z } from 'zod'

export const SaveInvoiceSchema = z.object({
  data: z.object({
    store_name: z.string().min(1),
    store_cnpj: z.string().nullable(),
    store_address: z.string().nullable(),
    invoice_number: z.string().nullable(),
    purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    items: z
      .array(
        z.object({
          description: z.string().min(1),
          quantity: z.number().positive(),
          unit_price: z.number().nonnegative(),
          total_price: z.number().positive(),
        })
      )
      .min(1),
    total_amount: z.number().positive(),
  }),
  filename: z.string().min(1),
})

export const CreateShoppingListSchema = z.object({
  name: z.string().max(100).optional(),
})

export const AddListItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive().optional().default(1),
})

export const UpdateListItemSchema = z.object({
  item_id: z.number().int().positive().optional(),
  checked: z.boolean().optional(),
  quantity: z.number().int().positive().optional(),
  status: z.enum(['active', 'completed']).optional(),
})

export const DeleteListItemSchema = z.object({
  item_id: z.number().int().positive().optional(),
})

export const UpdateAlertSchema = z.object({
  id: z.number().int().positive(),
  read: z.boolean(),
})

export const UpdatePreferencesSchema = z.object({
  alert_threshold: z.number().finite().min(0).max(100).optional(),
  notify_price_increase: z.boolean().optional(),
  notify_opportunities: z.boolean().optional(),
  notify_restock_reminders: z.boolean().optional(),
  notify_weekly_summary: z.boolean().optional(),
}).strict()

export const DeleteAllDataSchema = z.object({
  confirmation: z.string().trim().toLowerCase().refine(
    value => value === 'excluir',
    'Digite "excluir" para confirmar a exclusão de todos os dados'
  ),
}).strict()

export const ComparableBaseUnitSchema = z.enum(['kg', 'L', 'un'])
export const ProductGroupSuggestionStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'superseded'])
export const HISTORY_PERIOD_DAYS = [30, 90, 180] as const
export const DEFAULT_HISTORY_PERIOD_DAYS = 90
export const HistoryPeriodDaysParamSchema = z.enum(['30', '90', '180']).transform(value => Number(value) as typeof HISTORY_PERIOD_DAYS[number])

const DisplayNameSchema = z.string().trim().min(1).max(255)
const BrandSchema = z.string().trim().min(1).max(255).nullable()

export const CreateProductGroupSchema = z.object({
  display_name: DisplayNameSchema,
  base_unit: ComparableBaseUnitSchema,
})

export const UpdateProductGroupSchema = z.object({
  display_name: DisplayNameSchema,
})

export const UpdateProductSchema = z.object({
  brand: BrandSchema.optional(),
  units_per_pack: z.number().int().positive().nullable().optional(),
})

export const AssignProductGroupSchema = z.object({
  group_id: z.number().int().positive(),
  allow_missing_comparable_evidence: z.boolean().optional(),
})

export const ProductGroupResponseSchema = z.object({
  id: z.number().int().positive(),
  display_name: z.string(),
  base_unit: ComparableBaseUnitSchema,
})

export const ProductResponseSchema = z.object({
  id: z.number().int().positive(),
  brand: z.string().nullable(),
  units_per_pack: z.number().int().positive().nullable(),
})

export const ProductGroupAssignmentResponseSchema = z.object({
  product_id: z.number().int().positive(),
  group_id: z.number().int().positive(),
  display_name: z.string(),
  base_unit: ComparableBaseUnitSchema,
})

export const ProductGroupSuggestionResponseSchema = z.object({
  id: z.number().int().positive(),
  source_product_id: z.number().int().positive(),
  target_group_id: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  status: ProductGroupSuggestionStatusSchema,
})

export const ProductGroupSuggestionListResponseSchema = z.array(ProductGroupSuggestionResponseSchema)

export function parseHistoryPeriodDaysParam(value: string | null) {
  return HistoryPeriodDaysParamSchema.safeParse(value ?? String(DEFAULT_HISTORY_PERIOD_DAYS))
}
