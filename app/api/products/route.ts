import { sql } from '@/lib/db'
import { getSessionUserId } from '@/lib/auth-session'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''

  try {
    const userId = await getSessionUserId(request)
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let products

    if (search || category) {
      products = await sql`
        SELECT 
          p.id,
          p.normalized_name,
          p.category,
          p.brand,
          p.unit,
          COUNT(ii.id) as purchase_count,
          AVG(ii.unit_price) as avg_price,
          MAX(i.purchase_date) as last_purchase
        FROM products p
        LEFT JOIN invoice_items ii ON ii.product_id = p.id
        LEFT JOIN invoices i ON ii.invoice_id = i.id
        WHERE 
          p.user_id = ${userId} AND
          (${search} = '' OR p.normalized_name ILIKE ${'%' + search + '%'})
          AND (${category} = '' OR p.category = ${category})
        GROUP BY p.id, p.normalized_name, p.category, p.brand, p.unit
        ORDER BY purchase_count DESC
        LIMIT 50
      `
    } else {
      products = await sql`
        SELECT 
          p.id,
          p.normalized_name,
          p.category,
          p.brand,
          p.unit,
          COUNT(ii.id) as purchase_count,
          AVG(ii.unit_price) as avg_price,
          MAX(i.purchase_date) as last_purchase
        FROM products p
        LEFT JOIN invoice_items ii ON ii.product_id = p.id
        LEFT JOIN invoices i ON ii.invoice_id = i.id
        WHERE p.user_id = ${userId}
        GROUP BY p.id, p.normalized_name, p.category, p.brand, p.unit
        ORDER BY purchase_count DESC
        LIMIT 50
      `
    }

    // Get categories for filter
    const categories = await sql`
      SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND user_id = ${userId} ORDER BY category
    `

    return Response.json({
      products: products.map(p => ({
        ...p,
        avg_price: Number(p.avg_price) || 0,
        purchase_count: Number(p.purchase_count) || 0,
      })),
      categories: categories.map(c => c.category),
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
