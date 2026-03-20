import { describe, it, expect } from 'vitest'
import {
  SaveInvoiceSchema,
  CreateShoppingListSchema,
  AddListItemSchema,
  UpdateListItemSchema,
  DeleteListItemSchema,
  UpdateAlertSchema,
} from '../validations'

describe('SaveInvoiceSchema', () => {
  const validPayload = {
    data: {
      store_name: 'Supermercado ABC',
      store_cnpj: '12.345.678/0001-90',
      store_address: 'Rua Exemplo, 123',
      invoice_number: 'NF-001',
      purchase_date: '2025-01-15',
      items: [
        { description: 'Arroz 5kg', quantity: 1, unit_price: 25.9, total_price: 25.9 },
      ],
      total_amount: 25.9,
    },
    filename: 'nota.pdf',
  }

  it('should accept a valid invoice payload', () => {
    const result = SaveInvoiceSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('should accept nullable fields as null', () => {
    const result = SaveInvoiceSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, store_cnpj: null, store_address: null, invoice_number: null },
    })
    expect(result.success).toBe(true)
  })

  it('should reject empty store_name', () => {
    const result = SaveInvoiceSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, store_name: '' },
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid purchase_date format', () => {
    const result = SaveInvoiceSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, purchase_date: '15/01/2025' },
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty items array', () => {
    const result = SaveInvoiceSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, items: [] },
    })
    expect(result.success).toBe(false)
  })

  it('should reject zero or negative total_amount', () => {
    const result = SaveInvoiceSchema.safeParse({
      ...validPayload,
      data: { ...validPayload.data, total_amount: 0 },
    })
    expect(result.success).toBe(false)
  })

  it('should reject item with zero quantity', () => {
    const result = SaveInvoiceSchema.safeParse({
      ...validPayload,
      data: {
        ...validPayload.data,
        items: [{ description: 'Arroz', quantity: 0, unit_price: 10, total_price: 10 }],
      },
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty filename', () => {
    const result = SaveInvoiceSchema.safeParse({ ...validPayload, filename: '' })
    expect(result.success).toBe(false)
  })

  it('should reject missing data field', () => {
    const result = SaveInvoiceSchema.safeParse({ filename: 'nota.pdf' })
    expect(result.success).toBe(false)
  })
})

describe('CreateShoppingListSchema', () => {
  it('should accept empty object (name optional)', () => {
    const result = CreateShoppingListSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should accept a valid name', () => {
    const result = CreateShoppingListSchema.safeParse({ name: 'Compras da semana' })
    expect(result.success).toBe(true)
  })

  it('should reject name longer than 100 chars', () => {
    const result = CreateShoppingListSchema.safeParse({ name: 'x'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('AddListItemSchema', () => {
  it('should accept valid product_id', () => {
    const result = AddListItemSchema.safeParse({ product_id: 1 })
    expect(result.success).toBe(true)
  })

  it('should default quantity to 1', () => {
    const result = AddListItemSchema.safeParse({ product_id: 5 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.quantity).toBe(1)
    }
  })

  it('should reject negative product_id', () => {
    const result = AddListItemSchema.safeParse({ product_id: -1 })
    expect(result.success).toBe(false)
  })

  it('should reject non-integer product_id', () => {
    const result = AddListItemSchema.safeParse({ product_id: 1.5 })
    expect(result.success).toBe(false)
  })
})

describe('UpdateListItemSchema', () => {
  it('should accept checked boolean', () => {
    const result = UpdateListItemSchema.safeParse({ checked: true })
    expect(result.success).toBe(true)
  })

  it('should accept status enum', () => {
    const result = UpdateListItemSchema.safeParse({ status: 'completed' })
    expect(result.success).toBe(true)
  })

  it('should reject invalid status value', () => {
    const result = UpdateListItemSchema.safeParse({ status: 'invalid' })
    expect(result.success).toBe(false)
  })
})

describe('DeleteListItemSchema', () => {
  it('should accept valid item_id', () => {
    const result = DeleteListItemSchema.safeParse({ item_id: 10 })
    expect(result.success).toBe(true)
  })

  it('should accept empty object (item_id optional)', () => {
    const result = DeleteListItemSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('UpdateAlertSchema', () => {
  it('should accept valid id and read', () => {
    const result = UpdateAlertSchema.safeParse({ id: 1, read: true })
    expect(result.success).toBe(true)
  })

  it('should reject missing id', () => {
    const result = UpdateAlertSchema.safeParse({ read: true })
    expect(result.success).toBe(false)
  })

  it('should reject missing read', () => {
    const result = UpdateAlertSchema.safeParse({ id: 1 })
    expect(result.success).toBe(false)
  })

  it('should reject non-boolean read', () => {
    const result = UpdateAlertSchema.safeParse({ id: 1, read: 'yes' })
    expect(result.success).toBe(false)
  })
})
