'use client'

import { useState, useTransition } from 'react'
import { triggerLowStockAlertScan, type TriggerScanActionState } from './alert-actions'

interface LowStockTriggerProps {
  isAuthorized: boolean
  userRole?: string | null
}

export function LowStockTrigger({ isAuthorized, userRole }: LowStockTriggerProps) {
  const [isPending, startTransition] = useTransition()
  const [scanResult, setScanResult] = useState<TriggerScanActionState | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  const handleRunScan = () => {
    if (!isAuthorized || isPending) return

    setIsDismissed(false)
    startTransition(async () => {
      try {
        const result = await triggerLowStockAlertScan()
        setScanResult(result)
      } catch (err: unknown) {
        setScanResult({
          success: false,
          error:
            err instanceof Error
              ? err.message
              : 'Failed to complete low-stock scan due to an unexpected client error.',
        })
      }
    })
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-2 w-full sm:w-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto justify-end">
        <div className="text-left sm:text-right hidden sm:block">
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            Check current inventory against reorder levels and notify configured automation.
          </p>
        </div>

        {isAuthorized ? (
          <button
            type="button"
            onClick={handleRunScan}
            disabled={isPending}
            id="btn-run-low-stock-scan"
            aria-busy={isPending}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-teal-700 active:bg-teal-800 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {isPending ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Scanning Inventory...</span>
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4 text-indigo-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M10.5 8.25h3"
                  />
                </svg>
                <span>Run Low Stock Scan</span>
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              id="btn-run-low-stock-scan-disabled"
              aria-disabled="true"
              title="Only store managers and inventory staff can run automation scans."
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400 border border-slate-200 cursor-not-allowed"
            >
              <svg
                className="h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <span>Run Low Stock Scan</span>
            </button>
            <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-medium">
              {userRole ? `Role: ${userRole}` : 'Auth Required'}
            </span>
          </div>
        )}
      </div>

      {/* Result / Notification Feedback Box */}
      {scanResult && !isDismissed && (
        <div
          id="low-stock-scan-feedback"
          role="status"
          aria-live="polite"
          className={`w-full mt-3 rounded-xl border p-4 text-sm shadow-xs transition-all ${
            scanResult.success
              ? scanResult.data?.failedCount && scanResult.data.failedCount > 0
                ? 'border-amber-300 bg-amber-50/80 text-amber-950'
                : 'border-emerald-300 bg-emerald-50/80 text-emerald-950'
              : 'border-red-300 bg-red-50/80 text-red-950'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 w-full">
              {scanResult.success ? (
                <div
                  className={`mt-0.5 rounded-full p-1 ${
                    scanResult.data?.failedCount && scanResult.data.failedCount > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              ) : (
                <div className="mt-0.5 rounded-full p-1 bg-red-100 text-red-700">
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                    />
                  </svg>
                </div>
              )}

              <div className="w-full space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">
                    {scanResult.success
                      ? 'Low Stock Scan Complete'
                      : 'Low Stock Scan Failed'}
                  </h4>
                </div>

                {scanResult.success && scanResult.data ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-700">
                      Evaluated <strong className="text-slate-900">{scanResult.data.totalEvaluated}</strong> items in inventory. Found{' '}
                      <strong className="text-slate-900">{scanResult.data.lowStockCount}</strong> product(s) at or below reorder threshold.
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200 shadow-2xs">
                        <span className="text-indigo-600">✓</span> Dispatched: {scanResult.data.dispatchedCount}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200 shadow-2xs">
                        <span className="text-blue-600">🛡️</span> Cooldown Suppressed: {scanResult.data.suppressedCount}
                      </span>
                      {scanResult.data.failedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 border border-red-200 shadow-2xs">
                          ⚠️ Failed: {scanResult.data.failedCount}
                        </span>
                      )}
                    </div>

                    {scanResult.data.alerts.length > 0 && (
                      <div className="mt-2.5 rounded-lg bg-white/95 p-3 border border-slate-200 text-xs shadow-2xs">
                        <p className="font-semibold text-slate-800 mb-2">Detected Low-Stock Alerts:</p>
                        <ul className="divide-y divide-slate-100 max-h-40 overflow-y-auto pr-1">
                          {scanResult.data.alerts.map((alert, idx) => (
                            <li
                              key={`${alert.productId}-${idx}`}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1.5 first:pt-0 last:pb-0"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {alert.productName}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                  ({alert.storeName})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600">
                                <span>
                                  Stock: <strong className="text-slate-800">{alert.currentStock}</strong> / Min:{' '}
                                  <strong className="text-slate-800">{alert.reorderLevel}</strong>
                                  <span className="text-rose-600 ml-1 font-mono font-medium">(-{alert.deficit})</span>
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                                    alert.status === 'dispatched'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : alert.status === 'suppressed_duplicate'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {alert.status.replace('_', ' ')}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {scanResult.data.lowStockCount === 0 && (
                      <p className="text-emerald-800 font-medium">
                        All monitored inventory is currently above reorder levels. No automated alerts dispatched.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-red-800">{scanResult.error || 'Unknown error occurred.'}</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              aria-label="Dismiss scan results"
              className="rounded-md p-1.5 text-slate-400 hover:text-slate-600 hover:bg-black/5 focus:outline-hidden focus:ring-2 focus:ring-slate-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
