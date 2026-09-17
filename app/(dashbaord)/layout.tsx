import { createClient } from '@/lib/supabase/server'
import SidebarNav, { type NavigationItem } from './sidebar-nav'

type UserRole =
  | 'admin_owner'
  | 'store_manager'
  | 'sales_staff'
  | 'inventory_staff'
  | 'customer'

const USER_ROLES: UserRole[] = [
  'admin_owner',
  'store_manager',
  'sales_staff',
  'inventory_staff',
  'customer',
]

const fullNavigation: NavigationItem[] = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/products', label: 'Products' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/goods-receipts', label: 'Goods Receipts' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/sales', label: 'Sales / POS' },
  { href: '/payments', label: 'Payments' },
  { href: '/customers', label: 'Customers' },
  { href: '/returns', label: 'Returns' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/reports', label: 'Reports' },
  { href: '/ai-assistant', label: 'AI Assistant' },
]

const customerNavigation: NavigationItem[] = [
  { href: '/customer-portal', label: 'Customer Dashboard' },
  { href: '/customer-portal#profile', label: 'My Profile' },
  { href: '/customer-portal#purchases', label: 'My Purchases / Orders' },
  { href: '/customer-portal#payments', label: 'My Payments / Invoices' },
  { href: '/customer-portal#returns', label: 'My Returns' },
  { href: '/customer-portal#loyalty', label: 'Loyalty Points' },
  { href: '/customer-portal#promotions', label: 'Promotions' },
  { href: '/customer-portal#feedback', label: 'Feedback' },
]

const navigationByRole: Record<UserRole, NavigationItem[]> = {
  admin_owner: fullNavigation,
  store_manager: fullNavigation,
  sales_staff: [
    { href: '/dashboard', label: 'Overview' },
    { href: '/sales', label: 'Sales / POS' },
    { href: '/payments', label: 'Payments' },
    { href: '/customers', label: 'Customers' },
    { href: '/returns', label: 'Returns' },
  ],
  inventory_staff: [
    { href: '/dashboard', label: 'Overview' },
    { href: '/products', label: 'Products' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/purchases', label: 'Purchases' },
    { href: '/goods-receipts', label: 'Goods Receipts' },
    { href: '/suppliers', label: 'Suppliers' },
  ],
  customer: customerNavigation,
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLES.includes(value as UserRole)
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()
  let role: UserRole | null = null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)

    const organizationId = memberships?.[0]?.organization_id

    if (organizationId) {
      const { data: resolvedRole } = await supabase.rpc('get_user_role', {
        org_id: organizationId,
      })

      if (isUserRole(resolvedRole)) {
        role = resolvedRole
      }
    }
  }

  const navigationItems = role ? navigationByRole[role] : []

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      <SidebarNav
        navigationItems={navigationItems}
        userEmail={user?.email ?? null}
        userRole={role}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {children}
      </div>
    </div>
  )
}
