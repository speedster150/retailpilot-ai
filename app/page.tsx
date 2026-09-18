import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StructuredDataScript } from '@/lib/seo/structured-data'
import { RETAILPILOT_FAQS } from '@/lib/seo/faqs'
import { SITE_CONFIG } from '@/lib/seo/config'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Authenticated users are routed directly to their workspace
  if (user) {
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

  // Public presentation for unauthenticated visitors, search engines, and AI answer engines
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      <StructuredDataScript faqs={RETAILPILOT_FAQS} />

      {/* Global Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-hidden"
            aria-label="RetailPilot AI Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-lg shadow-md group-hover:bg-indigo-500 transition">
              RP
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-400 transition">
                RetailPilot AI
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-indigo-400">
                Enterprise Retail SaaS
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#overview" className="hover:text-white transition">
              Overview
            </a>
            <a href="#capabilities" className="hover:text-white transition">
              Capabilities
            </a>
            <a href="#aeo-geo" className="hover:text-white transition">
              AEO & Architecture
            </a>
            <a href="#faq" className="hover:text-white transition">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition"
            >
              Sign In to Workspace
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section id="overview" className="relative overflow-hidden py-20 sm:py-28 lg:py-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(79,70,229,0.25),rgba(255,255,255,0))]" />

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Next-Gen Retail SaaS • Double-Entry Ledger • Model Context Protocol
              </div>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Intelligent Retail Management & Immutable Inventory Ledger
              </h1>

              <p className="mt-6 text-lg leading-8 text-slate-300">
                RetailPilot AI unifies high-speed Point of Sale, double-entry inventory ledger accounting,
                automated supplier reorders, and an autonomous AI assistant powered by the Model Context Protocol (MCP).
              </p>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="rounded-lg bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
                >
                  Access Workspace
                </Link>
                <a
                  href="#capabilities"
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-6 py-3 text-base font-semibold text-slate-200 hover:bg-slate-800 hover:text-white transition"
                >
                  Explore Capabilities
                </a>
              </div>

              {/* Factual Technical Highlights */}
              <div className="mt-14 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-10 sm:grid-cols-4">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-white">FIFO Ledger</span>
                  <span className="text-xs text-slate-400">Zero Phantom Stock</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-white">PostgreSQL RLS</span>
                  <span className="text-xs text-slate-400">Multi-Tenant Isolation</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-white">MCP Tools</span>
                  <span className="text-xs text-slate-400">Autonomous AI Intelligence</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-white">Make.com Hooks</span>
                  <span className="text-xs text-slate-400">Automated Reorder Alerts</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Capabilities Section */}
        <section id="capabilities" className="border-t border-slate-800/80 bg-slate-900/40 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Platform Architecture & Capabilities
              </h2>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Engineered for High-Velocity Retail Operations
              </p>
              <p className="mt-4 text-base text-slate-300">
                Every component is constructed with mathematical precision, from FIFO inventory valuation to real-time sales transactions.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {/* Capability 1 */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xs hover:border-slate-700 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">Immutable Double-Entry Ledger</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                  Inventory is tracked as an append-only transaction ledger. Sales, goods receipts, returns, and write-offs record debit/credit lines, eliminating inventory drift and concurrency race conditions.
                </p>
              </article>

              {/* Capability 2 */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xs hover:border-slate-700 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">High-Speed Point of Sale (POS)</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                  Optimized for touchscreen terminals and handheld barcode scanners. Supports rapid item lookup, tiered discounts, split payments (cash/card/online), and instant voucher printing.
                </p>
              </article>

              {/* Capability 3 */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xs hover:border-slate-700 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">Autonomous AI via MCP</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                  Equipped with native Model Context Protocol (MCP) server integration. The AI assistant executes deterministic queries against live store data to answer inventory queries and summarize sales.
                </p>
              </article>

              {/* Capability 4 */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xs hover:border-slate-700 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">Automated Webhook Workflows</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                  Connects seamlessly to Make.com webhooks to dispatch low-stock threshold warnings, bi-weekly dead stock identification alerts, and automated end-of-day financial sales dossiers.
                </p>
              </article>

              {/* Capability 5 */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xs hover:border-slate-700 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">Multi-Tenant PostgreSQL RLS</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                  Zero data leakage across retail tenants. Supabase Row Level Security ensures every database read and write is authenticated and strictly scoped to the active organization ID.
                </p>
              </article>

              {/* Capability 6 */}
              <article className="rounded-2xl border border-slate-800 bg-slate-900/70 p-7 shadow-xs hover:border-slate-700 transition">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                  </svg>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-white">Reverse Sales & Returns</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-300">
                  Comprehensive return management with inspection condition logging, restocking fee adjustments, customer refund processing, and automated reverse ledger updates.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* AEO / GEO Answer Engine & Knowledge Section */}
        <section id="aeo-geo" className="border-t border-slate-800/80 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Answer Engine Optimization (AEO) & Entity Data
              </h2>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Direct Answers for Search & Generative AI Engines
              </p>
              <p className="mt-4 text-base text-slate-300">
                Factual specifications describing the RetailPilot AI system for search engines, AI overviews, and LLM answer systems.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                <h3 className="text-xl font-bold text-white">What is RetailPilot AI?</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  RetailPilot AI is a cloud-based multi-tenant retail management software-as-a-service (SaaS).
                  It integrates Point of Sale (POS), double-entry FIFO inventory accounting, procurement, supplier
                  settlements, and an autonomous AI assistant powered by the Model Context Protocol (MCP).
                </p>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                <h3 className="text-xl font-bold text-white">Who is RetailPilot AI for?</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  The software is built for independent retailers, supermarket chains, store managers, retail cashiers,
                  and procurement teams who require real-time ledger accuracy, automated stockout prevention, and
                  role-based access control without maintaining legacy on-premise servers.
                </p>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                <h3 className="text-xl font-bold text-white">What problems does RetailPilot AI solve?</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  RetailPilot AI eliminates phantom inventory caused by mutable stock counters, mitigates dead stock
                  through automated audit triggers, prevents stockouts with real-time reorder thresholds, and provides
                  grounded AI assistance that queries live store data via MCP rather than generating unverified responses.
                </p>
              </article>

              <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
                <h3 className="text-xl font-bold text-white">How does the Model Context Protocol (MCP) operate in RetailPilot AI?</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  RetailPilot AI implements a secure MCP server defining structured, read-only tools. When a store manager
                  asks the AI Assistant for stock levels, dead stock audits, or sales totals, the AI invokes registered MCP tools
                  that query the PostgreSQL database within the user’s organization scope.
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* Factual FAQ Section */}
        <section id="faq" className="border-t border-slate-800/80 bg-slate-900/40 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Everything You Need to Know About RetailPilot AI
              </p>
              <p className="mt-4 text-base text-slate-300">
                Direct, truthful answers regarding the platform’s security, architecture, and operational capabilities.
              </p>
            </div>

            <div className="mt-14 mx-auto max-w-4xl space-y-6">
              {RETAILPILOT_FAQS.map((faq, index) => (
                <article
                  key={index}
                  className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 shadow-xs hover:border-slate-700 transition"
                >
                  <h3 className="text-lg font-semibold text-white flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                      Q
                    </span>
                    <span>{faq.question}</span>
                  </h3>
                  <div className="mt-3 pl-9 text-sm leading-relaxed text-slate-300">
                    <p>{faq.answer}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Banner */}
        <section className="border-t border-slate-800/80 py-16 sm:py-20 bg-gradient-to-b from-slate-900/40 to-slate-950">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to Modernize Your Retail Store Operations?
            </h2>
            <p className="mt-4 text-base text-slate-300 max-w-2xl mx-auto">
              Sign in to your account to experience ledger-backed inventory precision, rapid POS checkout, and MCP-powered intelligence.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href="/login"
                className="rounded-lg bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-md hover:bg-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
              >
                Sign In to RetailPilot AI
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Global Semantic Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-12 text-slate-400 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
              RP
            </div>
            <span className="font-semibold text-slate-200">{SITE_CONFIG.name}</span>
            <span className="text-slate-600">•</span>
            <span>{SITE_CONFIG.legalName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#overview" className="hover:text-slate-200 transition">
              Overview
            </a>
            <a href="#capabilities" className="hover:text-slate-200 transition">
              Capabilities
            </a>
            <a href="#aeo-geo" className="hover:text-slate-200 transition">
              AEO & Architecture
            </a>
            <a href="#faq" className="hover:text-slate-200 transition">
              FAQ
            </a>
            <Link href="/login" className="hover:text-slate-200 transition">
              Sign In
            </Link>
          </div>

          <div className="text-slate-500">
            © {new Date().getFullYear()} {SITE_CONFIG.name}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
