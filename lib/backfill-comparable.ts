import type { PoolClient } from '@neondatabase/serverless'
import { buildComparablePricing } from './invoice-utils'

type RawItem = {
  id: number
  raw_description: string
  unit_price: string
  total_price: string
  quantity: string
}

export async function backfillComparablePricingForProduct(
  client: PoolClient,
  productId: number,
  userId: string,
  groupBaseUnit: string,
  unitsPerPack?: number | null
): Promise<number> {
  const { rows } = await client.query<RawItem>(
    `
      SELECT id, raw_description, unit_price, total_price, quantity
      FROM invoice_items
      WHERE product_id = $1
        AND user_id = $2
        AND comparable_unit_price IS NULL
    `,
    [productId, userId]
  )

  let updated = 0

  for (const row of rows) {
    const numericQty = Number(row.quantity)
    const numericTotal = Number(row.total_price)
    const numericUnit = Number(row.unit_price)

    let pricing = buildComparablePricing({
      description: row.raw_description,
      unit_price: numericUnit,
      total_price: numericTotal,
      quantity: numericQty,
    })

    if (
      (pricing.comparable_unit_price === null || pricing.comparable_base_unit !== groupBaseUnit) &&
      groupBaseUnit === 'un' &&
      unitsPerPack != null && unitsPerPack > 0
    ) {
      const totalUnits = unitsPerPack * (Number.isInteger(numericQty) && numericQty > 1 ? numericQty : 1)
      const unitPrice = Math.round((numericTotal / totalUnits) * 10000) / 10000
      pricing = {
        original_quantity: unitsPerPack,
        original_unit: 'un',
        comparable_base_unit: 'un',
        comparable_quantity_base: unitsPerPack,
        comparable_unit_price: unitPrice,
        measurement_source: 'description',
        measurement_confidence: 0.7,
        is_comparable: true,
        is_scale_item: false,
      }
    }

    if (
      pricing.comparable_unit_price === null ||
      pricing.comparable_base_unit === null ||
      pricing.comparable_base_unit !== groupBaseUnit
    ) {
      continue
    }

    await client.query(
      `
        UPDATE invoice_items SET
          comparable_base_unit     = $1,
          comparable_quantity_base = $2,
          comparable_unit_price    = $3,
          measurement_source       = $4,
          measurement_confidence   = $5
        WHERE id = $6
      `,
      [
        pricing.comparable_base_unit,
        pricing.comparable_quantity_base,
        pricing.comparable_unit_price,
        pricing.measurement_source,
        pricing.measurement_confidence,
        row.id,
      ]
    )

    updated++
  }

  return updated
}
