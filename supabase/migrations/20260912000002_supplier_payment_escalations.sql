-- Migration: 20260912000002_supplier_payment_escalations.sql
-- Description: Audit and state tracking table for Supplier Payment Escalations orchestrated via Make.com

create table if not exists public.supplier_payment_escalations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  po_number text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  store_id uuid references public.stores(id) on delete set null,
  store_name text,
  outstanding_amount numeric not null,
  due_date timestamptz,
  hours_remaining numeric,
  severity text not null check (severity in ('warning', 'critical', 'overdue')),
  status text not null check (status in ('dispatched', 'failed', 'suppressed_duplicate')),
  webhook_url_masked text,
  response_status integer,
  error_message text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for duplicate prevention, state queries, and reporting
create index if not exists idx_supplier_escalations_org_po_created
  on public.supplier_payment_escalations (organization_id, purchase_order_id, created_at desc);

create index if not exists idx_supplier_escalations_status_severity
  on public.supplier_payment_escalations (status, severity);

-- Enable Row Level Security (RLS)
alter table public.supplier_payment_escalations enable row level security;

-- RLS Policy: Authorized store/finance staff can view their organization's payment escalations
create policy "Staff can view organization supplier payment escalations"
  on public.supplier_payment_escalations
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );

-- RLS Policy: Authorized store/finance staff can insert supplier payment escalation records
create policy "Staff can insert organization supplier payment escalations"
  on public.supplier_payment_escalations
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );
