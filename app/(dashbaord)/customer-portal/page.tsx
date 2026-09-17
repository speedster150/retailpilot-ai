import { createClient } from '@/lib/supabase/server'

type Customer = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  address: string | null
  loyalty_points: number | string | null
  is_active: boolean | null
}

type Sale = {
  id: string
  invoice_number: string | null
  status: string | null
  sale_date: string | null
  total_amount: number | string | null
}

type SaleItem = {
  sale_id: string | null
  quantity: number | string | null
}

type Payment = {
  id: string
  sale_id: string | null
  amount: number | string | null
  payment_method: string | null
  payment_status: string | null
  transaction_reference: string | null
  paid_at: string | null
}

type ReturnRecord = {
  id: string
  return_number: string | null
  sale_id: string | null
  status: string | null
  reason: string | null
  refund_amount: number | string | null
  returned_at: string | null
}

function toNumber(value: number | string | null | undefined) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(toNumber(value))
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date)
}

function formatStatus(value: string | null) {
  if (!value) return 'Unknown'

  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function emptyState(title: string, message: string) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
      <h3 className="font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-600">{message}</p>
    </div>
  )
}

export default async function CustomerPortalPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <h2 className="font-medium">Sign in required</h2>
          <p className="mt-1 text-sm">Please sign in to view your portal.</p>
        </section>
      </main>
    )
  }

  const { data: memberships, error: membershipError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)

  const organizationId = memberships?.[0]?.organization_id

  if (membershipError || !organizationId) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="font-medium">Unable to verify your organization</h2>
          <p className="mt-1 text-sm">
            Your account does not have a valid organization membership.
          </p>
        </section>
      </main>
    )
  }

  const { data: role, error: roleError } = await supabase.rpc('get_user_role', {
    org_id: organizationId,
  })

  if (roleError || role !== 'customer') {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <h2 className="font-medium">Permission denied</h2>
          <p className="mt-1 text-sm">
            This portal is available only to customer accounts.
          </p>
        </section>
      </main>
    )
  }

  const { data: customerData, error: customerError } = await supabase
    .from('customers')
    .select('id, name, phone, email, address, loyalty_points, is_active')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()
  const customer = customerData as Customer | null

  if (customerError) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="font-medium">Unable to load your customer profile</h2>
          <p className="mt-1 text-sm">
            We could not safely resolve the customer record linked to this account.
          </p>
        </section>
      </main>
    )
  }

  if (!customer || customer.is_active === false) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <h2 className="font-medium">Customer profile unavailable</h2>
          <p className="mt-1 text-sm">
            This account is not linked to an active customer profile.
          </p>
        </section>
      </main>
    )
  }

  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('id, invoice_number, status, sale_date, total_amount')
    .eq('organization_id', organizationId)
    .eq('customer_id', customer.id)
    .order('sale_date', { ascending: false })

  if (salesError) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="font-medium">Unable to load your purchases</h2>
          <p className="mt-1 text-sm">
            We could not retrieve purchases for your linked customer profile.
          </p>
        </section>
      </main>
    )
  }

  const sales = (salesData ?? []) as Sale[]
  const saleIds = sales.map((sale) => sale.id)

  const [saleItemsResult, paymentsResult, returnsResult] = await Promise.all([
    saleIds.length > 0
      ? supabase.from('sale_items').select('sale_id, quantity').in('sale_id', saleIds)
      : Promise.resolve({ data: [], error: null }),
    saleIds.length > 0
      ? supabase
          .from('payments')
          .select(
            'id, sale_id, amount, payment_method, payment_status, transaction_reference, paid_at'
          )
          .in('sale_id', saleIds)
          .order('paid_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    saleIds.length > 0
      ? supabase
          .from('returns')
          .select(
            'id, return_number, sale_id, status, reason, refund_amount, returned_at'
          )
          .eq('organization_id', organizationId)
          .eq('customer_id', customer.id)
          .in('sale_id', saleIds)
          .order('returned_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  const relatedDataError =
    saleItemsResult.error ?? paymentsResult.error ?? returnsResult.error

  if (relatedDataError) {
    return (
      <main className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="font-medium">Unable to load portal activity</h2>
          <p className="mt-1 text-sm">
            Some of your purchase, payment, or return information could not be retrieved.
          </p>
        </section>
      </main>
    )
  }

  const saleItems = (saleItemsResult.data ?? []) as SaleItem[]
  const payments = (paymentsResult.data ?? []) as Payment[]
  const returns = (returnsResult.data ?? []) as ReturnRecord[]
  const itemCounts = new Map<string, number>()

  for (const item of saleItems) {
    if (item.sale_id) {
      itemCounts.set(
        item.sale_id,
        (itemCounts.get(item.sale_id) ?? 0) + toNumber(item.quantity)
      )
    }
  }

  const totalPurchases = sales.reduce(
    (total, sale) => total + toNumber(sale.total_amount),
    0
  )
  const totalPayments = payments.reduce(
    (total, payment) => total + toNumber(payment.amount),
    0
  )

  return (
    <main className="space-y-8 p-6">
      <section>
        <p className="text-sm font-medium text-gray-500">Customer Dashboard</p>
        <h1 className="mt-1 text-3xl font-semibold text-gray-900">
          Welcome, {customer.name ?? user.email ?? 'Customer'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          View your purchases, payments, returns, and loyalty information.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">Purchases</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{sales.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">Total purchases</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalPurchases)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">Payments</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {formatCurrency(totalPayments)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">Loyalty points</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {toNumber(customer.loyalty_points).toLocaleString('en-IN')}
          </p>
        </div>
      </section>

      <section id="profile" className="scroll-mt-6 space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Profile</h2>
          <p className="mt-1 text-sm text-gray-600">Your linked customer information.</p>
        </div>
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Name</p>
            <p className="mt-1 text-sm text-gray-900">{customer.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
            <p className="mt-1 break-all text-sm text-gray-900">
              {customer.email ?? user.email ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Phone</p>
            <p className="mt-1 text-sm text-gray-900">{customer.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Address</p>
            <p className="mt-1 text-sm text-gray-900">{customer.address ?? '—'}</p>
          </div>
        </div>
      </section>

      <section id="purchases" className="scroll-mt-6 space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Purchases / Orders</h2>
          <p className="mt-1 text-sm text-gray-600">Only sales linked to your customer record are shown.</p>
        </div>
        {sales.length === 0 ? (
          emptyState('No purchases yet', 'Your completed purchases will appear here.')
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-[700px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Items</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 font-medium text-gray-900">{sale.invoice_number ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-gray-700">{formatDate(sale.sale_date)}</td>
                    <td className="px-4 py-4 text-gray-700">{formatStatus(sale.status)}</td>
                    <td className="px-4 py-4 text-right text-gray-700">{itemCounts.get(sale.id) ?? 0}</td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(sale.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="payments" className="scroll-mt-6 space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Payments / Invoices</h2>
          <p className="mt-1 text-sm text-gray-600">Payments are limited to your purchases.</p>
        </div>
        {payments.length === 0 ? (
          emptyState('No payments yet', 'Payment records for your purchases will appear here.')
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Paid date</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const sale = sales.find((item) => item.id === payment.sale_id)

                  return (
                    <tr key={payment.id} className="border-t border-gray-200">
                      <td className="px-4 py-4 font-medium text-gray-900">{sale?.invoice_number ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                      <td className="px-4 py-4 text-gray-700">{payment.payment_method ?? '—'}</td>
                      <td className="px-4 py-4 text-gray-700">{formatStatus(payment.payment_status)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-gray-700">{formatDate(payment.paid_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="returns" className="scroll-mt-6 space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Returns</h2>
          <p className="mt-1 text-sm text-gray-600">Returns linked to your purchases.</p>
        </div>
        {returns.length === 0 ? (
          emptyState('No returns yet', 'Your approved returns will appear here.')
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="min-w-[800px] w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Return</th>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 text-right font-medium">Refund</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((returnRecord) => {
                  const sale = sales.find((item) => item.id === returnRecord.sale_id)

                  return (
                    <tr key={returnRecord.id} className="border-t border-gray-200">
                      <td className="px-4 py-4 font-medium text-gray-900">{returnRecord.return_number ?? '—'}</td>
                      <td className="px-4 py-4 text-gray-700">{sale?.invoice_number ?? '—'}</td>
                      <td className="px-4 py-4 text-gray-700">{formatStatus(returnRecord.status)}</td>
                      <td className="px-4 py-4 text-gray-700">{returnRecord.reason ?? '—'}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-right font-semibold text-gray-900">{formatCurrency(returnRecord.refund_amount)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-gray-700">{formatDate(returnRecord.returned_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="loyalty" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Loyalty Points</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">Current balance</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {toNumber(customer.loyalty_points).toLocaleString('en-IN')} points
          </p>
        </div>
      </section>

      <section id="promotions" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Promotions</h2>
        {emptyState('Promotions are coming soon', 'Promotion data is not available yet.')}
      </section>

      <section id="feedback" className="scroll-mt-6 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900">Feedback</h2>
        {emptyState('Feedback is coming soon', 'Customer feedback submission is not available yet.')}
      </section>
    </main>
  )
}
