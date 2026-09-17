import { createClient } from '@/lib/supabase/server'
import GoodsReceiptManagement, {
  type GoodsReceipt,
  type GoodsReceiptItem,
  type PurchaseOrderItemOption,
  type PurchaseOrderOption,
} from './goods-receipt-management'

const GOODS_RECEIPT_ROLES = new Set([
  'admin_owner',
  'store_manager',
  'inventory_staff',
])

export default async function GoodsReceiptsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record received warehouse shipments and post verified stock movements to the ledger.
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
                Please sign in to your RetailPilot account to access goods receipt records.
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
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record received warehouse shipments and post verified stock movements to the ledger.
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

  if (!GOODS_RECEIPT_ROLES.has(membership.role)) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record received warehouse shipments and post verified stock movements to the ledger.
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
                Your role ({membership.role}) does not have permission to receive goods. Only store managers, inventory staff, and owners can record goods receipts.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const organizationId = membership.organization_id
  const [receiptsResult, purchaseOrdersResult, purchaseOrderItemsResult] =
    await Promise.all([
      supabase
        .from('goods_receipts')
        .select(`
          id,
          organization_id,
          receipt_number,
          purchase_order_id,
          store_id,
          received_date,
          status,
          notes,
          purchase_orders (po_number),
          stores (name, code)
        `)
        .eq('organization_id', organizationId)
        .order('received_date', { ascending: false }),
      supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          store_id,
          suppliers (name),
          stores (name, code)
        `)
        .eq('organization_id', organizationId)
        .order('order_date', { ascending: false }),
      supabase
        .from('purchase_order_items')
        .select(`
          id,
          purchase_order_id,
          product_id,
          quantity,
          unit_cost,
          products (name, sku),
          purchase_orders!inner (organization_id)
        `)
        .eq('purchase_orders.organization_id', organizationId),
    ])

  const queryError =
    receiptsResult.error ??
    purchaseOrdersResult.error ??
    purchaseOrderItemsResult.error

  if (queryError) {
    return (
      <main className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Record received warehouse shipments and post verified stock movements to the ledger.
          </p>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h2 className="font-semibold text-base">Unable to Load Goods Receipts</h2>
              <p className="mt-1 text-sm text-red-700">
                There was a problem retrieving goods receipts or linked purchase orders. Please try again later.
              </p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const receipts = (receiptsResult.data ?? []) as GoodsReceipt[]
  const purchaseOrders = (purchaseOrdersResult.data ?? []) as PurchaseOrderOption[]
  const purchaseOrderItems =
    (purchaseOrderItemsResult.data ?? []) as PurchaseOrderItemOption[]

  let receiptItems: GoodsReceiptItem[] = []

  if (receipts.length > 0) {
    const { data, error } = await supabase
      .from('goods_receipt_items')
      .select('goods_receipt_id, quantity_received')
      .in(
        'goods_receipt_id',
        receipts.map((receipt) => receipt.id)
      )

    if (error) {
      return (
        <main className="space-y-6 p-6 max-w-7xl mx-auto">
          <div className="border-b border-slate-200 pb-5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Goods Receipts</h1>
            <p className="mt-1 text-sm text-slate-500">
              Record received warehouse shipments and post verified stock movements to the ledger.
            </p>
          </div>
          <section className="rounded-xl border border-red-200 bg-red-50/80 p-5 text-red-950 shadow-xs">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h2 className="font-semibold text-base">Unable to Load Receipt Items</h2>
                <p className="mt-1 text-sm text-red-700">
                  There was a problem retrieving received quantities for existing receipts.
                </p>
              </div>
            </div>
          </section>
        </main>
      )
    }

    receiptItems = (data ?? []) as GoodsReceiptItem[]
  }

  return (
    <GoodsReceiptManagement
      receipts={receipts}
      receiptItems={receiptItems}
      purchaseOrders={purchaseOrders}
      purchaseOrderItems={purchaseOrderItems}
    />
  )
}
