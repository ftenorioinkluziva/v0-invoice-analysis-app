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
