'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export type ReportData = {
  summary?: string | null
  gross_sales?: number | string | null
  refunds?: number | string | null
  expenses?: number | string | null
  top_product?: string | null
  notes?: string | null
  [key: string]: unknown
}

export type BusinessReport = {
  id: string
  report_type: string | null
  period_start: string | null
  period_end: string | null
  report_data: ReportData | null
  generated_by: string | null
  created_at: string | null
}

function toNumber(value: number | string | null | undefined): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const amount = toNumber(value)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
      }).format(date)
}

function formatLabel(value: string | null): string {
  if (!value) return 'Business Report'
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return '—'
  }
}

export function ReportsView({ initialReports }: { initialReports: BusinessReport[] }) {
  const [reports] = useState<BusinessReport[]>(initialReports)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  // Report types available
  const reportTypes = useMemo(() => {
    const set = new Set<string>()
    for (const r of reports) {
      if (r.report_type) set.add(r.report_type)
    }
    return Array.from(set).sort()
  }, [reports])

  // Aggregate Executive KPI Metrics
  const aggregateMetrics = useMemo(() => {
    let totalGrossSales = 0
    let totalRefunds = 0
    let totalExpenses = 0

    for (const r of reports) {
      totalGrossSales += toNumber(r.report_data?.gross_sales)
      totalRefunds += toNumber(r.report_data?.refunds)
      totalExpenses += toNumber(r.report_data?.expenses)
    }

    const netOperating = totalGrossSales - totalRefunds - totalExpenses
    const operatingMargin = totalGrossSales > 0 ? Math.round((netOperating / totalGrossSales) * 100) : 0

    return {
      totalGrossSales,
      totalRefunds,
      totalExpenses,
      netOperating,
      operatingMargin,
      totalReports: reports.length,
    }
  }, [reports])

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const q = searchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        (r.report_type ?? '').toLowerCase().includes(q) ||
        (r.report_data?.summary ?? '').toLowerCase().includes(q) ||
        (r.report_data?.notes ?? '').toLowerCase().includes(q) ||
        (r.report_data?.top_product ?? '').toLowerCase().includes(q) ||
        (r.generated_by ?? '').toLowerCase().includes(q)

      const matchesType =
        typeFilter === 'ALL' || (r.report_type ?? '').toLowerCase() === typeFilter.toLowerCase()

      return matchesSearch && matchesType
    })
  }, [reports, searchQuery, typeFilter])

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Executive Reports & Financial Intelligence
              </h1>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                {reports.length} {reports.length === 1 ? 'Report' : 'Reports'}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Automated monthly executive digests, periodic sales performance summaries, and store profitability audits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus:outline-hidden transition"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print / Export PDF</span>
          </button>

          <Link
            href="/ai-assistant"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus:outline-hidden transition"
          >
            <svg className="h-4 w-4 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Generate via AI Pilot</span>
          </Link>
        </div>
      </div>

      {/* Aggregate KPI Summary Deck */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Gross Sales</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs">
              📈
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {formatCurrency(aggregateMetrics.totalGrossSales)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">across generated periods</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Costs & Refunds</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-700 border border-rose-100 text-xs">
              📉
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700">
              {formatCurrency(aggregateMetrics.totalExpenses + aggregateMetrics.totalRefunds)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400 truncate">
            Exp: {formatCurrency(aggregateMetrics.totalExpenses)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Net Retained</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs">
              💰
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {formatCurrency(aggregateMetrics.netOperating)}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-600">after costs & refunds</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs font-semibold uppercase tracking-wider">Operating Margin</p>
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs">
              📊
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-700">
              {aggregateMetrics.operatingMargin}%
            </span>
          </div>
          <p className="mt-1 text-xs text-indigo-600">efficiency ratio</p>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search reports by type, summary findings, author, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by report type"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="ALL">All Report Types</option>
            {reportTypes.map((t) => (
              <option key={t} value={t}>
                {formatLabel(t)}
              </option>
            ))}
          </select>

          <span className="text-xs text-slate-500 whitespace-nowrap pl-1">
            Showing <strong>{filteredReports.length}</strong> of {reports.length}
          </span>
        </div>
      </div>

      {/* Report Cards Feed */}
      {filteredReports.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {searchQuery || typeFilter !== 'ALL' ? 'No Matching Reports Found' : 'No Reports Generated Yet'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery || typeFilter !== 'ALL'
              ? 'Try modifying your search query or reset the report type filter.'
              : 'Business reports synthesize revenue, inventory turns, cost of goods, and operating disbursements into executive summaries.'}
          </p>
          <div className="mt-4">
            {searchQuery || typeFilter !== 'ALL' ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setTypeFilter('ALL')
                }}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
              >
                Clear Filters
              </button>
            ) : (
              <Link
                href="/ai-assistant"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 transition"
              >
                + Ask AI Assistant to Generate Report
              </Link>
            )}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {filteredReports.map((report) => {
            const data = report.report_data ?? {}
            const gross = toNumber(data.gross_sales)
            const refunds = toNumber(data.refunds)
            const expenses = toNumber(data.expenses)
            const net = gross - refunds - expenses
            const isSelected = selectedReportId === report.id

            // Visual bar proportions
            const totalDenominator = Math.max(1, gross)
            const netPercent = Math.max(0, Math.min(100, Math.round((net / totalDenominator) * 100)))
            const expensePercent = Math.max(0, Math.min(100, Math.round((expenses / totalDenominator) * 100)))
            const refundPercent = Math.max(0, Math.min(100, Math.round((refunds / totalDenominator) * 100)))

            return (
              <article
                key={report.id}
                className={`rounded-2xl border bg-white p-6 shadow-xs transition-all ${
                  isSelected ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                        {formatLabel(report.report_type)}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: {report.id.slice(0, 12)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">
                      {formatLabel(report.report_type)} Performance Dossier
                    </h2>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs md:text-right font-medium">
                    <div>
                      <dt className="text-slate-400">Audit Period</dt>
                      <dd className="text-slate-800 font-semibold">
                        {formatDate(report.period_start)} – {formatDate(report.period_end)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Generated On</dt>
                      <dd className="text-slate-800 font-semibold">
                        {formatDate(report.created_at)}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-slate-400">Synthesized By</dt>
                      <dd className="text-slate-700 font-mono text-[11px] truncate max-w-xs md:ml-auto">
                        {report.generated_by ?? 'RetailPilot MCP Engine'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Executive Summary Callout Box (Stitch Design Accent) */}
                {data.summary && (
                  <div className="mt-5 rounded-xl border-l-4 border-l-indigo-600 border border-slate-200 bg-slate-50/75 p-4 text-xs leading-relaxed text-slate-800">
                    <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-900 text-[11px] mb-1">
                      <span>📌</span> Executive Briefing Summary
                    </div>
                    <p className="text-sm font-normal text-slate-700">{formatText(data.summary)}</p>
                  </div>
                )}

                {/* Visual Revenue & Cost Distribution Bar */}
                {gross > 0 && (
                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Capital Distribution</span>
                      <span className="text-slate-500 font-normal">
                        Gross Basis: {formatCurrency(gross)}
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
                      <div
                        style={{ width: `${netPercent}%` }}
                        className="bg-emerald-500 transition-all duration-500"
                        title={`Net Operating: ${formatCurrency(net)} (${netPercent}%)`}
                      />
                      <div
                        style={{ width: `${expensePercent}%` }}
                        className="bg-amber-400 transition-all duration-500"
                        title={`Expenses: ${formatCurrency(expenses)} (${expensePercent}%)`}
                      />
                      <div
                        style={{ width: `${refundPercent}%` }}
                        className="bg-rose-400 transition-all duration-500"
                        title={`Refunds: ${formatCurrency(refunds)} (${refundPercent}%)`}
                      />
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" /> Net Margin ({netPercent}%)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-400" /> Operating Costs ({expensePercent}%)
                      </span>
                      {refundPercent > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-rose-400" /> Returns/Refunds ({refundPercent}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Key Financials & Operational Insights Grid */}
                <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <dt className="text-xs font-medium text-slate-500">Gross Sales</dt>
                    <dd className="mt-1 text-lg font-bold font-mono text-slate-900">
                      {formatCurrency(gross)}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-rose-100 bg-rose-50/30 p-3.5">
                    <dt className="text-xs font-medium text-rose-800">Sales Refunds</dt>
                    <dd className="mt-1 text-lg font-bold font-mono text-rose-700">
                      {formatCurrency(refunds)}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-3.5">
                    <dt className="text-xs font-medium text-amber-800">Disbursed Expenses</dt>
                    <dd className="mt-1 text-lg font-bold font-mono text-amber-700">
                      {formatCurrency(expenses)}
                    </dd>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3.5">
                    <dt className="text-xs font-medium text-emerald-800">Net Operating Return</dt>
                    <dd className="mt-1 text-lg font-bold font-mono text-emerald-700">
                      {formatCurrency(net)}
                    </dd>
                  </div>
                </dl>

                {/* Additional Metadata: Top Product & Strategic Notes */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {data.top_product && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3.5 flex items-start gap-3">
                      <span className="text-xl">🏆</span>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-indigo-900">
                          Top Velocity Product
                        </div>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">
                          {formatText(data.top_product)}
                        </div>
                      </div>
                    </div>
                  )}

                  {data.notes && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-700">
                      <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                        <span>📝</span> Strategic Observations & Notes
                      </div>
                      <p className="leading-relaxed text-slate-600">{formatText(data.notes)}</p>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs">
                  <span className="text-slate-400 font-mono">
                    Period: {formatDate(report.period_start)} – {formatDate(report.period_end)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedReportId(isSelected ? null : report.id)}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {isSelected ? 'Collapse Details' : 'Highlight Report'}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
