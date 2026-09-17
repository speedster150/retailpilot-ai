-- Migration: 20260912000003_daily_sales_dossiers.sql
-- Description: Audit and state tracking table for Daily End-of-Day Sales Dossiers orchestrated via Make.com

create table if not exists public.daily_sales_dossiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  store_name text,
  business_date text not null,
  timezone text not null default 'UTC',
  gross_revenue numeric not null default 0,
  refund_amount numeric not null default 0,
  net_revenue numeric not null default 0,
  sales_count integer not null default 0,
  refunds_count integer not null default 0,
  total_units_sold integer not null default 0,
  top_products jsonb not null default '[]'::jsonb,
  payment_methods jsonb not null default '[]'::jsonb,
  status text not null check (status in ('dispatched', 'failed', 'suppressed_duplicate')),
  webhook_url_masked text,
  response_status integer,
  error_message text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for duplicate detection, reporting, and queries
create index if not exists idx_daily_sales_dossiers_org_store_date
  on public.daily_sales_dossiers (organization_id, store_id, business_date);

create index if not exists idx_daily_sales_dossiers_status_created
  on public.daily_sales_dossiers (status, created_at desc);

-- Enable Row Level Security (RLS)
alter table public.daily_sales_dossiers enable row level security;

-- RLS Policy: Authorized store and finance managers can view daily sales dossiers
create policy "Staff can view organization daily sales dossiers"
  on public.daily_sales_dossiers
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );

-- RLS Policy: Authorized store and finance staff can insert daily sales dossiers
create policy "Staff can insert organization daily sales dossiers"
  on public.daily_sales_dossiers
  for insert
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      where om.user_id = auth.uid()
        and om.role in ('admin_owner', 'store_manager', 'inventory_staff')
    )
  );
