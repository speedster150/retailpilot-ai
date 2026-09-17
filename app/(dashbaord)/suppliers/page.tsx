import { createClient } from '@/lib/supabase/server'
import SupplierManagement, {
  type Supplier,
  type SupplierPurchaseOrderSummary,
} from './supplier-management'

const SUPPLIER_MANAGEMENT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

export default async function SuppliersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage vendor directories, contact details, and procurement terms.
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
                Please sign in to your RetailPilot account to access supplier directories.
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage vendor directories, contact details, and procurement terms.
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

  if (!SUPPLIER_MANAGEMENT_ROLES.has(membership.role)) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage vendor directories, contact details, and procurement terms.
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
                Your role ({membership.role}) does not have permission to manage suppliers. Only store managers, inventory staff, and owners can access this directory.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const [suppliersResult, purchaseOrdersResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select(
        'id, organization_id, name, contact_person, phone, email, address, payment_terms, is_active, created_at'
      )
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_orders')
      .select('id, supplier_id, status')
      .eq('organization_id', membership.organization_id),
  ])

  if (suppliersResult.error) {
    return (
      <main className="w-full min-w-0 max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage vendor directories, contact details, and procurement terms.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Load Suppliers</h2>
              <p className="mt-1 text-sm text-red-700">
                There was a problem retrieving supplier records from the database. Please reload the page.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const suppliers = (suppliersResult.data ?? []) as Supplier[]
  const purchaseOrders = (purchaseOrdersResult.data ?? []) as SupplierPurchaseOrderSummary[]

  return (
    <SupplierManagement
      suppliers={suppliers}
      purchaseOrders={purchaseOrders}
    />
  )
}
