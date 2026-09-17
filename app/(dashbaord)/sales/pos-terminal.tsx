'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { processSaleCheckout, type PosLineItem } from './actions'

export type PosProduct = {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  selling_price: number | string | null
  cost_price: number | string | null
  reorder_level: number | string | null
  category_id: string | null
  category_name?: string | null
  current_stock?: number
}

export type PosStore = {
  id: string
  name: string
  code: string | null
}

export type PosCustomer = {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyalty_points: number | string | null
}

export type RecordedSale = {
  id: string
  invoice_number: string | null
  status: string | null
  sale_date: string | null
  subtotal: number | string | null
  discount_amount: number | string | null
  tax_amount: number | string | null
  total_amount: number | string | null
  store_name?: string | null
  store_code?: string | null
}

interface PosTerminalProps {
  initialProducts: PosProduct[]
  stores: PosStore[]
  customers: PosCustomer[]
  initialSales: RecordedSale[]
}

export default function PosTerminal({
  initialProducts,
  stores,
  customers,
  initialSales,
}: PosTerminalProps) {
  const [activeTab, setActiveTab] = useState<'pos' | 'history'>('pos')
  const [selectedStoreId, setSelectedStoreId] = useState<string>(
    stores[0]?.id || ''
  )
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [cart, setCart] = useState<PosLineItem[]>([])
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'credit_card' | 'debit_card' | 'upi'
  >('cash')

  // Status & Feedback States
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successModal, setSuccessModal] = useState<{
    invoiceNumber: string
    totalAmount: number
    paymentMethod: string
    date: string
  } | null>(null)

  // Barcode scanner input ref
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Formatters
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount)
  }

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>()
    initialProducts.forEach((p) => {
      if (p.category_name) set.add(p.category_name)
    })
    return ['all', ...Array.from(set)]
  }, [initialProducts])

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return initialProducts.filter((product) => {
      const matchesCategory =
        selectedCategory === 'all' || product.category_name === selectedCategory
      if (!matchesCategory) return false

      if (!q) return true
      const nameMatch = product.name.toLowerCase().includes(q)
      const skuMatch = product.sku?.toLowerCase().includes(q)
      const barcodeMatch = product.barcode?.toLowerCase().includes(q)
      return Boolean(nameMatch || skuMatch || barcodeMatch)
    })
  }, [initialProducts, searchQuery, selectedCategory])

  // Add Product to Cart
  const handleAddToCart = (product: PosProduct) => {
    setErrorMessage(null)
    const unitPrice = Number(product.selling_price) || 0

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.productId === product.id)
      if (existing) {
        return prevCart.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                totalPrice: (item.quantity + 1) * item.unitPrice,
              }
            : item
        )
      }
      return [
        ...prevCart,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          quantity: 1,
          unitPrice,
          totalPrice: unitPrice,
        },
      ]
    })
  }

  // Handle Barcode Scan / Enter key in Search
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const query = searchQuery.trim().toLowerCase()
      if (!query) return

      // Find exact barcode match first, then exact SKU, then single matching product
      const matched =
        initialProducts.find((p) => p.barcode?.toLowerCase() === query) ||
        initialProducts.find((p) => p.sku?.toLowerCase() === query) ||
        (filteredProducts.length === 1 ? filteredProducts[0] : null)

      if (matched) {
        handleAddToCart(matched)
        setSearchQuery('')
      } else {
        setErrorMessage(`No product found for barcode / SKU: "${searchQuery}"`)
      }
    }
  }

  // Update Cart Quantity
  const handleUpdateQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId)
      return
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? {
              ...item,
              quantity: newQty,
              totalPrice: newQty * item.unitPrice,
            }
          : item
      )
    )
  }

  // Remove Item
  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId))
  }

  // Clear Cart
  const handleClearCart = () => {
    setCart([])
    setDiscountPercent(0)
    setErrorMessage(null)
  }

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.totalPrice, 0)
  }, [cart])

  const discountAmount = useMemo(() => {
    return (subtotal * (discountPercent || 0)) / 100
  }, [subtotal, discountPercent])

  const taxableAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount)
  }, [subtotal, discountAmount])

  const taxAmount = useMemo(() => {
    // 5% standard tax rounded to 2 decimal places
    return Math.round(taxableAmount * 0.05 * 100) / 100
  }, [taxableAmount])

  const grandTotal = useMemo(() => {
    return Math.round((taxableAmount + taxAmount) * 100) / 100
  }, [taxableAmount, taxAmount])

  const totalItemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0)
  }, [cart])

  // Checkout Execution
  const handleCheckout = () => {
    if (!selectedStoreId) {
      setErrorMessage('Please select a store location before checkout.')
      return
    }
    if (cart.length === 0) {
      setErrorMessage('Your cart is empty. Please add products to complete sale.')
      return
    }

    setErrorMessage(null)

    startTransition(async () => {
      const result = await processSaleCheckout({
        storeId: selectedStoreId,
        customerId: selectedCustomerId || null,
        items: cart,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount: grandTotal,
        paymentMethod,
      })

      if (result.success && result.invoiceNumber) {
        setSuccessModal({
          invoiceNumber: result.invoiceNumber,
          totalAmount: result.totalAmount || grandTotal,
          paymentMethod,
          date: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        })
        setCart([])
        setDiscountPercent(0)
      } else {
        setErrorMessage(result.error || 'Failed to complete checkout transaction.')
      }
    })
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header & Terminal Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-2xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </span>
              Point of Sale (POS)
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Register
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Fast counter cashier terminal, barcode lookup, and instant payment settlement.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pos')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
              activeTab === 'pos'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
            }`}
          >
            ⚡ Register / Checkout
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
            }`}
          >
            📋 Sales Log ({initialSales.length})
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-900 flex items-center justify-between shadow-xs transition-all"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700 font-bold p-1 rounded-md hover:bg-red-100/50"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* SUCCESS MODAL / RECEIPT VOUCHER */}
      {successModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="success-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-2xs">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 id="success-modal-title" className="text-xl font-bold text-slate-900">
                Sale Completed Successfully!
              </h2>
              <p className="text-xs text-slate-500">
                Inventory movement posted to immutable ledger and invoice recorded.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 text-xs sm:text-sm border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {successModal.invoiceNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Amount Received:</span>
                <span className="font-bold text-emerald-700 text-base">{formatCurrency(successModal.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Settlement Method:</span>
                <span className="uppercase font-semibold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded text-[11px]">
                  {successModal.paymentMethod.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Timestamp:</span>
                <span className="text-slate-700">{successModal.date}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSuccessModal(null)}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl shadow-xs transition-colors text-sm"
              >
                + Start Next Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS REGISTER VIEW */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Product Catalog & Search (7 Cols on desktop) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Top Toolbar: Store & Customer Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
              <div>
                <label htmlFor="pos-store-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Active Store Location *
                </label>
                <select
                  id="pos-store-select"
                  value={selectedStoreId}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="pos-customer-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Profile (Optional)
                </label>
                <select
                  id="pos-customer-select"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition"
                >
                  <option value="">Walk-in Customer (General Account)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} — {c.loyalty_points || 0} pts
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search & Barcode Input */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  ref={searchInputRef}
                  id="pos-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan barcode or search by name / SKU (Press Enter to add)..."
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-28 py-2.5 text-sm text-slate-900 shadow-2xs placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition"
                />
                <div className="absolute inset-y-0 right-2 flex items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 border border-slate-200">
                    <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                    Scanner Ready
                  </span>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Products' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Grid */}
            {filteredProducts.length === 0 ? (
              // NO SEARCH RESULTS STATE
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center space-y-2 shadow-xs">
                <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-800">No products found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery
                    ? `No products matched "${searchQuery}". Try another name or scan the item barcode.`
                    : 'No products available in this category.'}
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map((product) => {
                  const inCartItem = cart.find((i) => i.productId === product.id)
                  const unitPrice = Number(product.selling_price) || 0

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className={`text-left p-3.5 rounded-xl border transition-all duration-150 flex flex-col justify-between relative group hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 ${
                        inCartItem
                          ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                      style={{ minHeight: '110px' }}
                    >
                      {inCartItem && (
                        <span className="absolute top-2.5 right-2.5 bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                          ×{inCartItem.quantity}
                        </span>
                      )}
                      <div>
                        <span className="block text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                          {product.name}
                        </span>
                        <span className="block text-[11px] font-mono text-slate-400 mt-1">
                          {product.sku || 'No SKU'}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-900">
                          {formatCurrency(unitPrice)}
                        </span>
                        <span className="text-[11px] font-semibold text-indigo-600 group-hover:underline">
                          + Add
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Cart & Checkout (5 Cols on desktop, sticky) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">Current Cart</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-slate-200">
                  {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Cart Line Items */}
            {cart.length === 0 ? (
              // EMPTY CART STATE
              <div className="py-12 text-center space-y-2.5">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-1">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-800">Your Cart is Empty</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Scan a barcode or click on any catalog item to begin building the order.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs transition-colors hover:bg-slate-50"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-semibold text-slate-900 truncate">
                        {item.productName}
                      </p>
                      <p className="text-slate-500 text-[11px] font-mono mt-0.5">
                        {formatCurrency(item.unitPrice)} each
                      </p>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center text-sm shadow-2xs"
                        aria-label={`Decrease ${item.productName}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateQuantity(item.productId, parseInt(e.target.value, 10) || 1)}
                        className="w-10 h-7 text-center rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-900"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 flex items-center justify-center text-sm shadow-2xs"
                        aria-label={`Increase ${item.productName}`}
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="text-right pl-3 shrink-0">
                      <p className="font-bold text-slate-900 text-xs">
                        {formatCurrency(item.totalPrice)}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-[11px] text-rose-500 hover:text-rose-700 mt-0.5 hover:underline"
                        aria-label={`Remove ${item.productName}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Financial Summary */}
            <div className="border-t border-slate-200 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span className="flex items-center gap-1.5">
                  Discount (%):
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-14 rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-right font-medium"
                  />
                </span>
                <span className="font-semibold text-rose-600">
                  -{formatCurrency(discountAmount)}
                </span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Tax (5% Standard GST):</span>
                <span className="font-semibold text-slate-900">{formatCurrency(taxAmount)}</span>
              </div>

              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-100 pt-2.5">
                <span>Grand Total:</span>
                <span className="text-lg text-indigo-700 font-extrabold">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-semibold text-slate-700">
                Settlement Payment Method
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['cash', 'upi', 'credit_card', 'debit_card'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-1 text-center rounded-lg border text-[11px] font-bold transition-all ${
                      paymentMethod === method
                        ? 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {method === 'credit_card'
                      ? 'Credit Card'
                      : method === 'debit_card'
                      ? 'Debit Card'
                      : method === 'upi'
                      ? 'UPI / QR'
                      : 'Cash'}
                  </button>
                ))}
              </div>
            </div>

            {/* Complete Sale Action Button */}
            <button
              id="pos-checkout-btn"
              type="button"
              disabled={isPending || cart.length === 0}
              onClick={handleCheckout}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-xs transition-colors text-sm flex items-center justify-center gap-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
            >
              {isPending ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <>
                  <span>Complete Checkout ({formatCurrency(grandTotal)})</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SALES HISTORY VIEW */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recorded Sales Log</h2>
              <p className="text-xs text-slate-500">Historical customer sales receipts and immutable inventory movement records</p>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Showing last {initialSales.length} transactions
            </span>
          </div>

          {initialSales.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-800">No sales recorded yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Completed transactions from the POS register will appear in this audit log immediately.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-4 py-3.5">Store Location</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Transaction Date</th>
                    <th className="px-4 py-3.5 text-right">Subtotal</th>
                    <th className="px-4 py-3.5 text-right">Discount</th>
                    <th className="px-4 py-3.5 text-right">Tax (GST)</th>
                    <th className="px-5 py-3.5 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {initialSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-xs">
                          {sale.invoice_number || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-700 font-medium">
                        {sale.store_name || '—'}
                        {sale.store_code && (
                          <span className="ml-1 text-[11px] text-slate-400 font-mono">({sale.store_code})</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {sale.status || 'Completed'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600 text-xs">
                        {sale.sale_date ? new Date(sale.sale_date).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600 text-xs font-mono">
                        {formatCurrency(Number(sale.subtotal) || 0)}
                      </td>
                      <td className="px-4 py-4 text-right text-rose-600 text-xs font-mono">
                        {Number(sale.discount_amount) > 0 ? `-${formatCurrency(Number(sale.discount_amount))}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600 text-xs font-mono">
                        {formatCurrency(Number(sale.tax_amount) || 0)}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-900 text-sm font-mono">
                        {formatCurrency(Number(sale.total_amount) || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
