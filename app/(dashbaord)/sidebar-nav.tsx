'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './logout-button'

export type NavigationItem = {
  href: string
  label: string
}

function getIcon(href: string) {
  if (href.startsWith('/dashboard')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  }
  if (href.startsWith('/products')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )
  }
  if (href.startsWith('/inventory')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    )
  }
  if (href.startsWith('/purchases')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    )
  }
  if (href.startsWith('/goods-receipts')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  }
  if (href.startsWith('/suppliers')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    )
  }
  if (href.startsWith('/sales')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )
  }
  if (href.startsWith('/payments')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }
  if (href.startsWith('/customers')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )
  }
  if (href.startsWith('/returns')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    )
  }
  if (href.startsWith('/expenses')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    )
  }
  if (href.startsWith('/reports')) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }
  if (href.startsWith('/ai-assistant')) {
    return (
      <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function getModuleIconClass(href: string, isActive: boolean, isAi: boolean) {
  if (isActive) return 'text-white'
  if (isAi) return 'text-indigo-600'
  if (href.startsWith('/products')) return 'text-blue-500 group-hover:text-blue-600'
  if (href.startsWith('/inventory')) return 'text-teal-500 group-hover:text-teal-600'
  if (href.startsWith('/purchases')) return 'text-indigo-500 group-hover:text-indigo-600'
  if (href.startsWith('/goods-receipts')) return 'text-sky-500 group-hover:text-sky-600'
  if (href.startsWith('/suppliers')) return 'text-violet-500 group-hover:text-violet-600'
  if (href.startsWith('/sales')) return 'text-emerald-500 group-hover:text-emerald-600'
  if (href.startsWith('/payments')) return 'text-emerald-500 group-hover:text-emerald-600'
  if (href.startsWith('/customers')) return 'text-blue-500 group-hover:text-blue-600'
  if (href.startsWith('/returns')) return 'text-rose-500 group-hover:text-rose-600'
  if (href.startsWith('/expenses')) return 'text-amber-500 group-hover:text-amber-600'
  if (href.startsWith('/reports')) return 'text-indigo-500 group-hover:text-indigo-600'
  return 'text-gray-400 group-hover:text-gray-600'
}

function roleBadgeColor(role: string | null) {
  switch (role) {
    case 'admin_owner':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'store_manager':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'inventory_staff':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'sales_staff':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'customer':
      return 'bg-zinc-50 text-zinc-700 border-zinc-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

function formatRoleName(role: string | null) {
  if (!role) return 'Staff'
  return role
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export default function SidebarNav({
  navigationItems,
  userEmail,
  userRole,
}: {
  navigationItems: NavigationItem[]
  userEmail: string | null
  userRole: string | null
}) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white font-bold text-sm">
            RP
          </div>
          <span className="font-bold text-gray-900 tracking-tight">RetailPilot AI</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden"
          aria-label="Toggle Navigation"
          aria-expanded={mobileMenuOpen}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Backdrop for mobile */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white border-r border-gray-200 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white font-bold text-sm shadow-xs">
              RP
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">RetailPilot AI</span>
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
            v0.9
          </span>
        </div>

        {/* User context badge */}
        <div className="px-5 py-3.5 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {userEmail ?? 'Authenticated User'}
            </p>
            <span
              className={`mt-1 inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${roleBadgeColor(
                userRole
              )}`}
            >
              {formatRoleName(userRole)}
            </span>
          </div>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navigationItems.length > 0 ? (
            navigationItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
              const isAi = item.href === '/ai-assistant'

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-hidden ${
                    isActive
                      ? 'bg-gray-900 text-white shadow-xs'
                      : isAi
                      ? 'text-indigo-600 hover:bg-indigo-50/70'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={getModuleIconClass(item.href, isActive, isAi)}>
                    {getIcon(item.href)}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {isAi && !isActive && (
                    <span className="ml-auto rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700">
                      AI
                    </span>
                  )}
                </Link>
              )
            })
          ) : (
            <p className="px-3 py-2 text-xs text-gray-500">Navigation is unavailable.</p>
          )}
        </nav>

        {/* Footer with logout */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/40">
          <LogoutButton />
        </div>
      </aside>
    </>
  )
}
