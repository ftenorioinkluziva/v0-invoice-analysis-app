import { sql } from '@/lib/db'
import { Pool } from '@neondatabase/serverless'
import { ExtractedInvoice } from '@/lib/types'
import { SaveInvoiceSchema } from '@/lib/validations'
import { normalizeProductName, categorizeProduct, validateItemPrices, extractUnit, buildComparablePricing } from '@/lib/invoice-utils'
import { getSessionUserId } from '@/lib/auth-session'
import { setAppUserId } from '@/lib/session-sql'

export async function GET(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoices = await sql`
      SELECT 
        i.id,
        i.invoice_number,
        i.purchase_date,
        i.total_amount,
        i.pdf_filename,
        i.processed_at,
        s.name as store_name,
        s.cnpj as store_cnpj,
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id AND user_id = ${userId}) as item_count
      FROM invoices i
      LEFT JOIN stores s ON i.store_id = s.id
      WHERE i.user_id = ${userId}
      ORDER BY i.purchase_date DESC
      LIMIT 50
    `
    return Response.json({ invoices })
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return Response.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsed = SaveInvoiceSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { data, filename } = parsed.data


    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const client = await pool.connect()
    // Seta app.user_id para isolamento RLS estrito
    await setAppUserId(client, userId)

    try {
      await client.query('BEGIN')

      // Upsert store — match by CNPJ when available, fallback to name
      let storeId: number

      if (data.store_cnpj) {
        const result = await client.query(`
          INSERT INTO stores (name, cnpj, address, user_id)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (cnpj) DO UPDATE SET name = EXCLUDED.name
          RETURNING id
        `, [data.store_name, data.store_cnpj, data.store_address, userId])
        storeId = result.rows[0].id
      } else {
        const existing = await client.query(`
          SELECT id FROM stores WHERE name = $1 AND user_id = $2 LIMIT 1
        `, [data.store_name, userId])
        
        if (existing.rows.length > 0) {
          storeId = existing.rows[0].id
        } else {
          const result = await client.query(`
            INSERT INTO stores (name, cnpj, address, user_id)
            VALUES ($1, NULL, $2, $3)
            RETURNING id
          `, [data.store_name, data.store_address, userId])
          storeId = result.rows[0].id
        }
      }

      // Check for duplicate invoice
      const duplicate = await client.query(`
        SELECT id FROM invoices
        WHERE user_id = $5 AND ((invoice_number IS NOT NULL AND invoice_number = $1)
          OR (store_id = $2 AND purchase_date = $3 AND total_amount = $4))
        LIMIT 1
      `, [data.invoice_number, storeId, data.purchase_date, data.total_amount, userId])
      
      if (duplicate.rows.length > 0) {
        await client.query('ROLLBACK')
        client.release()
        return Response.json(
          { error: 'Nota fiscal já importada', duplicateInvoiceId: duplicate.rows[0].id },
          { status: 409 }
        )
      }

      const invoiceResult = await client.query(`
        INSERT INTO invoices (store_id, invoice_number, purchase_date, total_amount, pdf_filename, user_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [storeId, data.invoice_number, data.purchase_date, data.total_amount, filename, userId])
      const invoiceId = invoiceResult.rows[0].id

      // Process items
      for (const item of data.items) {
        const validated = validateItemPrices(item)
        const comparablePricing = buildComparablePricing(validated)
        const normalizedName = normalizeProductName(validated.description)
        const category = categorizeProduct(validated.description)

        const productResult = await client.query(`
          SELECT id FROM products WHERE normalized_name = $1 AND user_id = $2 LIMIT 1
        `, [normalizedName, userId])

        let productId: number

        if (productResult.rows.length === 0) {
          const newProduct = await client.query(`
            INSERT INTO products (normalized_name, category, unit, user_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id
          `, [normalizedName, category, extractUnit(validated.description), userId])
          productId = newProduct.rows[0].id
        } else {
          productId = productResult.rows[0].id
        }

        await client.query(`
          INSERT INTO invoice_items (
            invoice_id,
            product_id,
            raw_description,
            quantity,
            unit_price,
            total_price,
            comparable_base_unit,
            comparable_quantity_base,
            comparable_unit_price,
            measurement_source,
            measurement_confidence,
            user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          invoiceId,
          productId,
          validated.description,
          validated.quantity,
          validated.unit_price,
          validated.total_price,
          comparablePricing.comparable_base_unit,
          comparablePricing.comparable_quantity_base,
          comparablePricing.comparable_unit_price,
          comparablePricing.measurement_source,
          comparablePricing.measurement_confidence,
          userId,
        ])
      }

      await client.query('COMMIT')
      client.release()

      // Check for price alerts
      await generatePriceAlerts(data.items, userId)

      return Response.json({ 
        success: true, 
        invoiceId,
        message: `Invoice saved with ${data.items.length} items` 
      })
    } catch (txError) {
      await client.query('ROLLBACK')
      client.release()
      throw txError
    }
  } catch (error) {
    console.error('Error saving invoice:', error)
    return Response.json({ error: 'Failed to save invoice' }, { status: 500 })
  }
}


async function generatePriceAlerts(items: ExtractedInvoice['items'], userId: string) {
  // Obter configurações de notificação dinamicamente
  const prefsConf = await sql`SELECT alert_threshold, notify_price_increase FROM user_preferences WHERE user_id = ${userId} LIMIT 1`
  const threshold = prefsConf.length > 0 ? Number(prefsConf[0].alert_threshold) : 15
  const notifyPriceIncrease = prefsConf.length > 0 ? prefsConf[0].notify_price_increase : true

  if (!notifyPriceIncrease) return;

  for (const item of items) {
    const normalizedName = normalizeProductName(item.description)
    
    // Get historical prices for this product
    const history = await sql`
      SELECT ii.unit_price, i.purchase_date
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE p.normalized_name = ${normalizedName} AND p.user_id = ${userId} AND ii.user_id = ${userId} AND i.user_id = ${userId}
      ORDER BY i.purchase_date DESC
      LIMIT 5
    `

    if (history.length >= 2) {
      const previousPrice = Number(history[1].unit_price)
      const currentPrice = item.unit_price
      const variation = ((currentPrice - previousPrice) / previousPrice) * 100

      if (variation > threshold) {
        const productResult = await sql`
          SELECT id FROM products WHERE normalized_name = ${normalizedName} AND user_id = ${userId} LIMIT 1
        `
        
        if (productResult.length > 0) {
          await sql`
            INSERT INTO alerts (product_id, alert_type, message, data, user_id)
            VALUES (
              ${productResult[0].id}, 
              'price_increase',
              ${`${item.description} aumentou ${variation.toFixed(1)}%`},
              ${JSON.stringify({ previous_price: previousPrice, current_price: currentPrice, variation })},
              ${userId}
            )
          `
        }
      }
    }
  }
}
