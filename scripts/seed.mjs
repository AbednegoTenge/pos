// Seeds demo categories and products for a Ghanaian provision shop.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars (service role,
// not the anon key, since RLS restricts writes to admin/manager staff).
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running this script.')
  process.exit(1)
}

const supabase = createClient(url, serviceKey)

const CATEGORIES = ['Beverages', 'Provisions', 'Toiletries', 'Snacks']

const PRODUCTS = [
  { name: 'Sachet Water (500ml)', category: 'Beverages', unit: 'pc', price: 0.5, stock: 200, vatExempt: true },
  { name: 'Milo 400g', category: 'Beverages', unit: 'pc', price: 45, stock: 30 },
  { name: 'Malta Guinness 33cl', category: 'Beverages', unit: 'bottle', price: 8, stock: 60 },
  { name: 'Ideal Milk (Evaporated)', category: 'Provisions', unit: 'tin', price: 12, stock: 80, vatExempt: true },
  { name: 'Gino Tomato Mix 400g', category: 'Provisions', unit: 'tin', price: 15, stock: 50 },
  { name: 'Rice (Local, 5kg)', category: 'Provisions', unit: 'bag', price: 65, stock: 40, vatExempt: true },
  { name: 'Cooking Oil (Frytol 1L)', category: 'Provisions', unit: 'bottle', price: 28, stock: 35 },
  { name: 'Sugar (1kg)', category: 'Provisions', unit: 'bag', price: 14, stock: 45, vatExempt: true },
  { name: 'Geisha Sardine', category: 'Provisions', unit: 'tin', price: 9, stock: 70 },
  { name: 'Key Soap', category: 'Toiletries', unit: 'pc', price: 6, stock: 90 },
  { name: 'Colgate Toothpaste 100ml', category: 'Toiletries', unit: 'pc', price: 11, stock: 55 },
  { name: 'Tampico Juice 1L', category: 'Beverages', unit: 'bottle', price: 13, stock: 40 },
  { name: 'Digestive Biscuits', category: 'Snacks', unit: 'pack', price: 7, stock: 65 },
  { name: 'TasteT Chips', category: 'Snacks', unit: 'pack', price: 3, stock: 100 },
]

async function main() {
  const categoryIds = {}
  for (const name of CATEGORIES) {
    const { data, error } = await supabase
      .from('categories')
      .upsert({ name }, { onConflict: 'name' })
      .select('id, name')
      .single()
    if (error) throw error
    categoryIds[data.name] = data.id
  }

  const rows = PRODUCTS.map((p) => ({
    name: p.name,
    category_id: categoryIds[p.category],
    unit: p.unit,
    price_ghs: p.price,
    vat_exempt: Boolean(p.vatExempt),
    stock_qty: p.stock,
    low_stock_threshold: 10,
  }))

  const { error } = await supabase.from('products').insert(rows)
  if (error) throw error

  console.log(`Seeded ${CATEGORIES.length} categories and ${rows.length} products.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
