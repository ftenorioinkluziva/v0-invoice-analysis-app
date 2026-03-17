import { sql } from '@/lib/db'
import { ExtractedInvoice } from '@/lib/types'

export async function GET() {
  try {
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
        (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) as item_count
      FROM invoices i
      LEFT JOIN stores s ON i.store_id = s.id
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
    const body = await request.json() as { data: ExtractedInvoice; filename: string }
    const { data, filename } = body

    // Find or create store
    let storeResult = await sql`
      SELECT id FROM stores WHERE name = ${data.store_name} LIMIT 1
    `

    let storeId: number

    if (storeResult.length === 0) {
      const newStore = await sql`
        INSERT INTO stores (name, cnpj, address)
        VALUES (${data.store_name}, ${data.store_cnpj}, ${data.store_address})
        RETURNING id
      `
      storeId = newStore[0].id
    } else {
      storeId = storeResult[0].id
    }

    // Create invoice
    const invoiceResult = await sql`
      INSERT INTO invoices (store_id, invoice_number, purchase_date, total_amount, pdf_filename)
      VALUES (${storeId}, ${data.invoice_number}, ${data.purchase_date}, ${data.total_amount}, ${filename})
      RETURNING id
    `
    const invoiceId = invoiceResult[0].id

    // Process items
    for (const item of data.items) {
      // Find or create product
      const normalizedName = normalizeProductName(item.description)
      const category = categorizeProduct(item.description)

      let productResult = await sql`
        SELECT id FROM products WHERE normalized_name = ${normalizedName} LIMIT 1
      `

      let productId: number

      if (productResult.length === 0) {
        const newProduct = await sql`
          INSERT INTO products (normalized_name, category, unit)
          VALUES (${normalizedName}, ${category}, ${extractUnit(item.description)})
          RETURNING id
        `
        productId = newProduct[0].id
      } else {
        productId = productResult[0].id
      }

      // Create invoice item
      await sql`
        INSERT INTO invoice_items (invoice_id, product_id, raw_description, quantity, unit_price, total_price)
        VALUES (${invoiceId}, ${productId}, ${item.description}, ${item.quantity}, ${item.unit_price}, ${item.total_price})
      `
    }

    // Check for price alerts
    await generatePriceAlerts(data.items)

    return Response.json({ 
      success: true, 
      invoiceId,
      message: `Invoice saved with ${data.items.length} items` 
    })
  } catch (error) {
    console.error('Error saving invoice:', error)
    return Response.json({ error: 'Failed to save invoice' }, { status: 500 })
  }
}

function normalizeProductName(description: string): string {
  return description
    .toLowerCase()
    .replace(/\d+\s*(ml|l|g|kg|un|pc|pct|cx|lt)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 4)
    .join(' ')
}

function categorizeProduct(description: string): string {
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

function extractUnit(description: string): string | null {
  const match = description.match(/(\d+)\s*(ml|l|g|kg|un|pc|pct|cx|lt)\b/i)
  return match ? `${match[1]}${match[2].toLowerCase()}` : null
}

async function generatePriceAlerts(items: ExtractedInvoice['items']) {
  for (const item of items) {
    const normalizedName = normalizeProductName(item.description)
    
    // Get historical prices for this product
    const history = await sql`
      SELECT ii.unit_price, i.purchase_date
      FROM invoice_items ii
      JOIN products p ON ii.product_id = p.id
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE p.normalized_name = ${normalizedName}
      ORDER BY i.purchase_date DESC
      LIMIT 5
    `

    if (history.length >= 2) {
      const previousPrice = Number(history[1].unit_price)
      const currentPrice = item.unit_price
      const variation = ((currentPrice - previousPrice) / previousPrice) * 100

      if (variation > 15) {
        const productResult = await sql`
          SELECT id FROM products WHERE normalized_name = ${normalizedName} LIMIT 1
        `
        
        if (productResult.length > 0) {
          await sql`
            INSERT INTO alerts (product_id, alert_type, message, data)
            VALUES (
              ${productResult[0].id}, 
              'price_increase',
              ${`${item.description} aumentou ${variation.toFixed(1)}%`},
              ${JSON.stringify({ previous_price: previousPrice, current_price: currentPrice, variation })}
            )
          `
        }
      }
    }
  }
}
