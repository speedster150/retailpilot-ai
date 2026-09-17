import { createClient } from '@/lib/supabase/server'
import PosTerminal, {
  type PosProduct,
  type PosStore,
  type PosCustomer,
  type RecordedSale,
} from './pos-terminal'

export default async function SalesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Point of Sale (POS)</h1>
          <p className="mt-1 text-sm text-slate-500">Fast counter register, barcode scanning, and instant checkout.</p>
        </div>
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Authentication Required</h2>
              <p className="mt-1 text-sm text-amber-800">Please sign in to your RetailPilot account to access the POS register.</p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', user.id)
    .limit(1)

  const organizationId = memberships?.[0]?.organization_id

  if (membershipError || !organizationId) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Point of Sale (POS)</h1>
          <p className="mt-1 text-sm text-slate-500">Fast counter register, barcode scanning, and instant checkout.</p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Resolve Organization</h2>
              <p className="mt-1 text-sm text-red-700">Could not determine the organization for your account. Please contact an administrator.</p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  // Fetch stores, products, customers, and sales in parallel
  const [storesResult, productsResult, customersResult, salesResult] =
    await Promise.all([
      supabase
        .from('stores')
        .select('id, name, code')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true }),

      supabase
        .from('products')
        .select(
          'id, name, sku, barcode, selling_price, cost_price, reorder_level, category_id, categories(name)'
        )
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true }),

      supabase
        .from('customers')
        .select('id, name, phone, email, loyalty_points')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true }),

      supabase
        .from('sales')
        .select(`
          id,
          invoice_number,
          status,
          sale_date,
          subtotal,
          discount_amount,
          tax_amount,
          total_amount,
          stores (
            name,
            code
          )
        `)
        .eq('organization_id', organizationId)
        .order('sale_date', { ascending: false })
        .limit(50),
    ])

  const stores: PosStore[] = (storesResult.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
  }))

  type ProductRow = {
    id: string
    name: string
    sku: string | null
    barcode: string | null
    selling_price: number | string | null
    cost_price: number | string | null
    reorder_level: number | string | null
    category_id: string | null
    categories: { name: string | null } | null
  }

  type SaleRow = {
    id: string
    invoice_number: string | null
    status: string | null
    sale_date: string | null
    subtotal: number | string | null
    discount_amount: number | string | null
    tax_amount: number | string | null
    total_amount: number | string | null
    stores: Array<{ name: string | null; code: string | null }> | null
  }

  const products: PosProduct[] = ((productsResult.data as unknown as ProductRow[]) ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    selling_price: p.selling_price,
    cost_price: p.cost_price,
    reorder_level: p.reorder_level,
    category_id: p.category_id,
    category_name: p.categories?.name ?? null,
  }))

  const customers: PosCustomer[] = (customersResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    loyalty_points: c.loyalty_points,
  }))

  const sales: RecordedSale[] = ((salesResult.data as unknown as SaleRow[]) ?? []).map((s) => ({
    id: s.id,
    invoice_number: s.invoice_number,
    status: s.status,
    sale_date: s.sale_date,
    subtotal: s.subtotal,
    discount_amount: s.discount_amount,
    tax_amount: s.tax_amount,
    total_amount: s.total_amount,
    store_name: s.stores?.[0]?.name ?? null,
    store_code: s.stores?.[0]?.code ?? null,
  }))

  return (
    <PosTerminal
      initialProducts={products}
      stores={stores}
      customers={customers}
      initialSales={sales}
    />
  )
}
