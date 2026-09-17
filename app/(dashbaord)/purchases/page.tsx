import { createClient } from '@/lib/supabase/server'
import PurchaseManagement, {
  type ProductOption,
  type ProductSupplierOption,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type StoreOption,
  type SupplierOption,
} from './purchase-management'

const PURCHASE_MANAGEMENT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

export default async function PurchasesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create purchase orders and track incoming supplier shipments.
          </p>
        </div>
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Authentication Required</h2>
              <p className="mt-1 text-sm text-amber-800">
                Please sign in to your RetailPilot account to access purchase orders.
              </p>
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

  const membership = memberships?.[0]

  if (membershipError || !membership?.organization_id) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create purchase orders and track incoming supplier shipments.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Resolve Organization</h2>
              <p className="mt-1 text-sm text-red-700">
                We could not identify the organization linked to this account. Please contact an administrator.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  if (!PURCHASE_MANAGEMENT_ROLES.has(membership.role)) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create purchase orders and track incoming supplier shipments.
          </p>
        </div>
        <section className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Access Restricted</h2>
              <p className="mt-1 text-sm text-amber-800">
                Your role ({membership.role}) does not have permission to view or manage purchase orders. Only store managers, inventory staff, and owners can access this section.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const organizationId = membership.organization_id
  const [purchaseOrdersResult, productsResult, suppliersResult, storesResult, productSuppliersResult] =
    await Promise.all([
      supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          order_date,
          expected_date,
          notes,
          suppliers (name),
          stores (name, code)
        `)
        .eq('organization_id', organizationId)
        .order('order_date', { ascending: false }),
      supabase
        .from('products')
        .select('id, name, sku, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true }),
      supabase
        .from('suppliers')
        .select('id, name, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true }),
      supabase
        .from('stores')
        .select('id, name, code, is_active')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true }),
      supabase
        .from('product_suppliers')
        .select(
          'id, product_id, supplier_id, supplier_sku, purchase_price, minimum_order_quantity, lead_time_days, is_preferred'
        )
        .eq('organization_id', organizationId),
    ])

  const queryError =
    purchaseOrdersResult.error ??
    productsResult.error ??
    suppliersResult.error ??
    storesResult.error ??
    productSuppliersResult.error

  if (queryError) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create purchase orders and track incoming supplier shipments.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Load Purchases</h2>
              <p className="mt-1 text-sm text-red-700">
                There was a problem retrieving purchase order data. Please check your connection and reload.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const purchaseOrders = (purchaseOrdersResult.data ?? []) as PurchaseOrder[]
  let items: PurchaseOrderItem[] = []
  let itemsError: { message?: string } | null = null

  if (purchaseOrders.length > 0) {
    const { data, error } = await supabase
      .from('purchase_order_items')
      .select('purchase_order_id, quantity')
      .in(
        'purchase_order_id',
        purchaseOrders.map((purchaseOrder) => purchaseOrder.id)
      )

    items = (data ?? []) as PurchaseOrderItem[]
    itemsError = error
  }

  if (itemsError) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Purchases</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create purchase orders and track incoming supplier shipments.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Load Order Items</h2>
              <p className="mt-1 text-sm text-red-700">
                There was a problem retrieving line items for purchase orders.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <PurchaseManagement
      purchaseOrders={purchaseOrders}
      purchaseOrderItems={items}
      products={(productsResult.data ?? []) as ProductOption[]}
      suppliers={(suppliersResult.data ?? []) as SupplierOption[]}
      stores={(storesResult.data ?? []) as StoreOption[]}
      productSuppliers={
        (productSuppliersResult.data ?? []) as ProductSupplierOption[]
      }
    />
  )
}
