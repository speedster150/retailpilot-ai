import { createClient } from '@/lib/supabase/server'
import ProductManagement, {
  type Category,
  type Product,
  type ProductSupplier,
  type SupplierOption,
} from './product-management'

const PRODUCT_MANAGEMENT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

export default async function ProductsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization inventory catalog, unit pricing, and supplier terms.
          </p>
        </div>
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-900 shadow-xs">
          <h2 className="font-semibold text-amber-900">Sign in required</h2>
          <p className="mt-1 text-sm text-amber-700">Please sign in to manage products.</p>
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
      <main className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization inventory catalog, unit pricing, and supplier terms.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-900 shadow-xs">
          <h2 className="font-semibold text-red-900">Unable to load your organization</h2>
          <p className="mt-1 text-sm text-red-700">
            We could not determine the organization for this account.
          </p>
        </section>
      </main>
    )
  }

  if (!PRODUCT_MANAGEMENT_ROLES.has(memberships[0].role)) {
    return (
      <main className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization inventory catalog, unit pricing, and supplier terms.
          </p>
        </div>
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-900 shadow-xs">
          <h2 className="font-semibold text-amber-900">Product management unavailable</h2>
          <p className="mt-1 text-sm text-amber-700">
            Your account does not have permission to manage catalog products. Requires Manager or Inventory role.
          </p>
        </section>
      </main>
    )
  }

  const [
    productsResult,
    categoriesResult,
    suppliersResult,
    productSuppliersResult,
  ] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, organization_id, name, sku, barcode, category_id, brand, cost_price, selling_price, tax_rate, reorder_level, is_active, created_at'
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('id, name')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true }),
    supabase
      .from('suppliers')
      .select('id, name, is_active')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true }),
    supabase
      .from('product_suppliers')
      .select(
        'id, organization_id, product_id, supplier_id, supplier_sku, purchase_price, minimum_order_quantity, lead_time_days, is_preferred, created_at'
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
  ])

  const queryError =
    productsResult.error ??
    categoriesResult.error ??
    suppliersResult.error ??
    productSuppliersResult.error

  if (queryError) {
    return (
      <main className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Products</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization inventory catalog, unit pricing, and supplier terms.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-900 shadow-xs">
          <h2 className="font-semibold text-red-900">Unable to load products</h2>
          <p className="mt-1 text-sm text-red-700">
            There was a problem retrieving products or categories from the database. Please try again later.
          </p>
          {queryError.message && (
            <p className="mt-2 text-xs font-mono text-red-600 bg-red-100/60 p-2 rounded">
              {queryError.message}
            </p>
          )}
        </section>
      </main>
    )
  }

  const products = (productsResult.data ?? []) as Product[]
  const categories = (categoriesResult.data ?? []) as Category[]
  const suppliers = (suppliersResult.data ?? []) as SupplierOption[]
  const productSuppliers = (productSuppliersResult.data ?? []) as ProductSupplier[]

  return (
    <ProductManagement
      products={products}
      categories={categories}
      suppliers={suppliers}
      productSuppliers={productSuppliers}
    />
  )
}
