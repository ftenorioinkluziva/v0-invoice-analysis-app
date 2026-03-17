import { sql } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const productId = parseInt(id)

    // Get product info
    const product = await sql`
      SELECT * FROM products WHERE id = ${productId} LIMIT 1
    `

    if (product.length === 0) {
      return Response.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get price history
    const priceHistory = await sql`
      SELECT 
        ii.unit_price as price,
        i.purchase_date as date,
        s.name as store_name
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN stores s ON i.store_id = s.id
      WHERE ii.product_id = ${productId}
      ORDER BY i.purchase_date DESC
      LIMIT 20
    `

    // Calculate stats
    const stats = await sql`
      SELECT 
        AVG(ii.unit_price) as avg_price,
        MIN(ii.unit_price) as min_price,
        MAX(ii.unit_price) as max_price
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE ii.product_id = ${productId}
        AND i.purchase_date >= NOW() - INTERVAL '6 months'
    `

    // Calculate 6-month variation
    const variationResult = await sql`
      WITH first_last AS (
        SELECT 
          (SELECT ii.unit_price 
           FROM invoice_items ii
           JOIN invoices i ON ii.invoice_id = i.id
           WHERE ii.product_id = ${productId}
           ORDER BY i.purchase_date ASC
           LIMIT 1) as first_price,
          (SELECT ii.unit_price 
           FROM invoice_items ii
           JOIN invoices i ON ii.invoice_id = i.id
           WHERE ii.product_id = ${productId}
           ORDER BY i.purchase_date DESC
           LIMIT 1) as last_price
      )
      SELECT 
        CASE 
          WHEN first_price > 0 
          THEN ((last_price - first_price) / first_price) * 100
          ELSE 0
        END as variation
      FROM first_last
    `

    return Response.json({
      product_id: product[0].id,
      product_name: product[0].normalized_name,
      category: product[0].category,
      prices: priceHistory.map(row => ({
        date: row.date,
        price: Number(row.price),
        store_name: row.store_name,
      })),
      stats: {
        avg_price: Number(stats[0].avg_price) || 0,
        min_price: Number(stats[0].min_price) || 0,
        max_price: Number(stats[0].max_price) || 0,
        price_variation_6m: Number(variationResult[0]?.variation) || 0,
      },
    })
  } catch (error) {
    console.error('Error fetching product history:', error)
    return Response.json({ error: 'Failed to fetch product history' }, { status: 500 })
  }
}
