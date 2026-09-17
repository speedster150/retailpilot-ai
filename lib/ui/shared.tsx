import React from 'react'

// ==============================================================================
// RetailPilot AI — Shared Enterprise Design System Components
// ==============================================================================

export type SemanticVariant =
  | 'blue'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'indigo'
  | 'violet'
  | 'teal'
  | 'sky'
  | 'neutral'

const VARIANT_STYLES: Record<
  SemanticVariant,
  {
    badge: string
    iconBg: string
    accentText: string
    border: string
  }
> = {
  blue: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBg: 'bg-blue-50 text-blue-700 border-blue-100',
    accentText: 'text-blue-700',
    border: 'border-blue-200',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    accentText: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  rose: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    iconBg: 'bg-rose-50 text-rose-700 border-rose-100',
    accentText: 'text-rose-700',
    border: 'border-rose-200',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-50 text-amber-700 border-amber-100',
    accentText: 'text-amber-700',
    border: 'border-amber-200',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconBg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    accentText: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  violet: {
    badge: 'bg-violet-50 text-violet-700 border-violet-200',
    iconBg: 'bg-violet-50 text-violet-700 border-violet-100',
    accentText: 'text-violet-700',
    border: 'border-violet-200',
  },
  teal: {
    badge: 'bg-teal-50 text-teal-700 border-teal-200',
    iconBg: 'bg-teal-50 text-teal-700 border-teal-100',
    accentText: 'text-teal-700',
    border: 'border-teal-200',
  },
  sky: {
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
    iconBg: 'bg-sky-50 text-sky-700 border-sky-100',
    accentText: 'text-sky-700',
    border: 'border-sky-200',
  },
  neutral: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    iconBg: 'bg-slate-100 text-slate-600 border-slate-200',
    accentText: 'text-slate-700',
    border: 'border-slate-200',
  },
}

// ------------------------------------------------------------------------------
// 1. Page Header Component
// ------------------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  badge,
  badgeVariant = 'neutral',
  icon,
  iconBgColor = 'bg-slate-900',
  actions,
}: {
  title: string
  description: string
  badge?: string | React.ReactNode
  badgeVariant?: SemanticVariant
  icon?: React.ReactNode
  iconBgColor?: string
  actions?: React.ReactNode
}) {
  const badgeStyle = VARIANT_STYLES[badgeVariant]?.badge ?? VARIANT_STYLES.neutral.badge

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
      <div>
        <div className="flex items-center gap-3">
          {icon && (
            <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBgColor} text-white shadow-2xs shrink-0`}>
              {icon}
            </span>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {badge && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${badgeStyle}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  )
}

// ------------------------------------------------------------------------------
// 2. Standardized KPI Card & Grid
// ------------------------------------------------------------------------------
export function KpiCard({
  label,
  value,
  unit,
  subtext,
  icon,
  variant = 'neutral',
}: {
  label: string
  value: string | number
  unit?: string
  subtext?: string
  icon?: React.ReactNode
  variant?: SemanticVariant
}) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.neutral

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-md border text-xs ${styles.iconBg}`}>
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${variant !== 'neutral' ? styles.accentText : 'text-slate-900'}`}>
          {value}
        </span>
        {unit && <span className="text-xs text-slate-400 font-medium">{unit}</span>}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-400 truncate">{subtext}</p>}
    </div>
  )
}

export function KpiGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4 | 6
}) {
  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : columns === 6
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
      : 'grid-cols-2 sm:grid-cols-4'

  return <div className={`grid gap-4 ${colClass}`}>{children}</div>
}

// ------------------------------------------------------------------------------
// 3. Filter / Control Surface Panel
// ------------------------------------------------------------------------------
export function FilterControlSurface({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs ${className}`}
    >
      {children}
    </div>
  )
}

// ------------------------------------------------------------------------------
// 4. Status Badge Component
// ------------------------------------------------------------------------------
export function StatusBadge({
  status,
  variant,
}: {
  status: string
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
}) {
  const norm = (status ?? '').toLowerCase().trim()
  let computedVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral' = variant ?? 'neutral'

  if (!variant) {
    if (['completed', 'active', 'received', 'paid', 'success', 'healthy', 'approved', 'preferred'].includes(norm)) {
      computedVariant = 'success'
    } else if (['pending', 'low_stock', 'low stock', 'warning', 'partially_received', 'due', 'overdue'].includes(norm)) {
      computedVariant = 'warning'
    } else if (['failed', 'out_of_stock', 'out of stock', 'error', 'cancelled', 'refunded', 'returned'].includes(norm)) {
      computedVariant = 'error'
    } else if (['draft', 'ordered', 'inbound', 'transit', 'credit'].includes(norm)) {
      computedVariant = 'info'
    }
  }

  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  }[computedVariant]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${styles}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          computedVariant === 'success'
            ? 'bg-emerald-500'
            : computedVariant === 'warning'
            ? 'bg-amber-500'
            : computedVariant === 'error'
            ? 'bg-rose-500'
            : computedVariant === 'info'
            ? 'bg-sky-500'
            : 'bg-slate-400'
        }`}
      />
      {status}
    </span>
  )
}

// ------------------------------------------------------------------------------
// 5. Content Panel Card
// ------------------------------------------------------------------------------
export function ContentCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
