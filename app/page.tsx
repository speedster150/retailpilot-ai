import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)

  const organizationId = memberships?.[0]?.organization_id

  if (organizationId) {
    const { data: role } = await supabase.rpc('get_user_role', {
      org_id: organizationId,
    })

    if (role === 'customer') {
      redirect('/customer-portal')
    }
  }

  redirect('/dashboard')
}
