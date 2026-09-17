import ChatInterface from './chat-interface'

export default function AIAssistantPage() {
  return (
    <main className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">RetailPilot AI Copilot</h1>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
                Autonomous Assistant
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Autonomous supermarket intelligence, predictive demand forecasting, and inventory risk detection powered by live Model Context Protocol (MCP) database tools.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shrink-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Intelligence Engine Active · Connected to Ledger</span>
        </div>
      </div>

      {/* AI Assistant Chat / Query Interface */}
      <ChatInterface />

      {/* Intelligent Capabilities Grid (Google Stitch Style) */}
      <section aria-labelledby="capabilities-heading" className="space-y-4">
        <h2 id="capabilities-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Autonomous Store Intelligence Systems
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Capability 1 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 mb-4 border border-blue-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Predictive Stock Forecasting</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Analyzes historical sales velocities and purchase lead times to predict stockout dates before supermarket shelves are depleted.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">Velocity ETS Algorithm</span>
              <span className="font-semibold text-indigo-600">Active</span>
            </div>
          </div>

          {/* Capability 2 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 mb-4 border border-amber-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Anomaly & Shrinkage Guard</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Continuously correlates goods receipts, physical inventory adjustments, and returns to highlight suspicious shrinkage discrepancies.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">Ledger Audit Monitor</span>
              <span className="font-semibold text-emerald-600">0 Discrepancies</span>
            </div>
          </div>

          {/* Capability 3 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col justify-between hover:border-slate-300 transition">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 mb-4 border border-purple-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-base">Autonomous Reorder Synthesis</h3>
              <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                Auto-generates draft Purchase Orders matching preferred supplier minimum order quantities (MOQ) and negotiated wholesale terms.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px]">Supplier Integration</span>
              <span className="font-semibold text-indigo-600">Ready</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
