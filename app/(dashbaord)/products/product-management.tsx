'use client'

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { KpiCard, KpiGrid, FilterControlSurface } from '@/lib/ui/shared'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  linkProductSupplier,
  saveProduct,
  toggleProductStatus,
} from './actions'
import type { ProductActionState } from './actions'

export type Product = {
  id: string
  organization_id: string
  name: string
  sku: string | null
  barcode: string | null
  category_id: string | null
  brand: string | null
  cost_price: number | string | null
  selling_price: number | string | null
  tax_rate: number | string | null
  reorder_level: number | string | null
  is_active: boolean
  created_at: string | null
}

export type Category = {
  id: string
  name: string
}

export type SupplierOption = {
  id: string
  name: string
  is_active: boolean
}

export type ProductSupplier = {
  id: string
  organization_id: string
  product_id: string
  supplier_id: string
  supplier_sku: string | null
  purchase_price: number | string | null
  minimum_order_quantity: number | string | null
  lead_time_days: number | string | null
  is_preferred: boolean
  created_at: string | null
}

const initialState: ProductActionState = {}

function toNumber(value: number | string | null) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function formatCurrency(value: number | string | null) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

function SubmitButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 active:bg-blue-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Saving...</span>
        </>
      ) : editing ? (
        'Update Product'
      ) : (
        'Add Product'
      )}
    </button>
  )
}

function ProductForm({
  categories,
  product,
  onCancel,
}: {
  categories: Category[]
  product: Product | null
  onCancel: () => void
}) {
  const [state, formAction] = useActionState(saveProduct, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      onCancel()
      router.refresh()
    }
  }, [onCancel, router, state.success])

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={product?.id ?? ''} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span className="font-semibold text-gray-700">Product Name *</span>
          <input
            required
            name="name"
            placeholder="e.g. Organic Arabica Coffee Beans 1kg"
            defaultValue={product?.name ?? ''}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">SKU Code</span>
          <input
            name="sku"
            placeholder="e.g. COF-ARA-01"
            defaultValue={product?.sku ?? ''}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Barcode</span>
          <input
            name="barcode"
            placeholder="e.g. 8901234567890"
            defaultValue={product?.barcode ?? ''}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 font-mono placeholder:text-gray-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Category</span>
          <select
            name="category_id"
            defaultValue={product?.category_id ?? ''}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Brand / Manufacturer</span>
          <input
            name="brand"
            placeholder="e.g. Blue Mountain"
            defaultValue={product?.brand ?? ''}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Cost Price (₹) *</span>
          <input
            required
            min="0"
            step="0.01"
            type="number"
            name="cost_price"
            placeholder="0.00"
            defaultValue={toNumber(product?.cost_price ?? 0)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Selling Price (₹) *</span>
          <input
            required
            min="0"
            step="0.01"
            type="number"
            name="selling_price"
            placeholder="0.00"
            defaultValue={toNumber(product?.selling_price ?? 0)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 font-semibold focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Tax Rate (%)</span>
          <input
            required
            min="0"
            max="100"
            step="0.01"
            type="number"
            name="tax_rate"
            placeholder="0"
            defaultValue={toNumber(product?.tax_rate ?? 0)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Reorder Threshold Level *</span>
          <input
            required
            min="0"
            step="1"
            type="number"
            name="reorder_level"
            placeholder="10"
            defaultValue={toNumber(product?.reorder_level ?? 0)}
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Listing Status</span>
          <select
            name="is_active"
            defaultValue={String(product?.is_active ?? true)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="true">Active (Listed in POS)</option>
            <option value="false">Inactive (Hidden from POS)</option>
          </select>
        </label>
      </div>

      {state.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800">
          <p className="font-semibold">Unable to save product</p>
          <p className="mt-0.5 text-xs text-red-700">{state.error}</p>
        </div>
      )}

      {state.success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-800">
          <p className="font-semibold">Success</p>
          <p className="mt-0.5 text-xs text-emerald-700">{state.success}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <SubmitButton editing={Boolean(product)} />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-gray-300 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function LinkSubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 transition"
    >
      {pending ? 'Linking...' : 'Link Supplier'}
    </button>
  )
}

function LinkSupplierForm({
  products,
  suppliers,
  onCancel,
}: {
  products: Product[]
  suppliers: SupplierOption[]
  onCancel: () => void
}) {
  const [state, formAction] = useActionState(
    linkProductSupplier,
    initialState
  )
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset()
      onCancel()
      router.refresh()
    }
  }, [onCancel, router, state.success])

  const hasOptions = products.length > 0 && suppliers.length > 0

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Catalog Product *</span>
          <select
            required
            name="product_id"
            defaultValue=""
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.sku ? ` (${product.sku})` : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Supplier Account *</span>
          <select
            required
            name="supplier_id"
            defaultValue=""
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          >
            <option value="">Select a supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
                {!supplier.is_active ? ' (Inactive)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Supplier SKU Code</span>
          <input
            name="supplier_sku"
            placeholder="e.g. SUP-COF-88"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 font-mono focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Contracted Purchase Price (₹) *</span>
          <input
            required
            min="0"
            step="0.01"
            type="number"
            name="purchase_price"
            placeholder="0.00"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Minimum Order Quantity (MOQ)</span>
          <input
            min="1"
            step="1"
            type="number"
            name="minimum_order_quantity"
            defaultValue="1"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Lead Time (Days)</span>
          <input
            min="0"
            step="1"
            type="number"
            name="lead_time_days"
            defaultValue="7"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 focus:border-indigo-600 focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20"
          />
        </label>
      </div>

      <label className="flex items-center gap-2.5 pt-1 text-sm text-gray-800 cursor-pointer">
        <input
          type="checkbox"
          name="is_preferred"
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
        />
        <span className="font-medium">Set as preferred supplier for automatic restocking</span>
      </label>

      {!hasOptions && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Ensure at least one product and one active supplier exist before creating a purchasing link.
        </div>
      )}

      {state.error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {state.error}
        </div>
      )}

      {state.success && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {state.success}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
        <LinkSubmitButton disabled={!hasOptions} />
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-hidden transition"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ToggleStatusButton({ product }: { product: Product }) {
  const [state, formAction] = useActionState(
    toggleProductStatus,
    initialState
  )
  const router = useRouter()
  const nextStatus = !product.is_active

  useEffect(() => {
    if (state.success) {
      router.refresh()
    }
  }, [router, state.success])

  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="is_active" value={String(nextStatus)} />
      <StatusSubmitButton isActive={product.is_active} />
      {state.error && (
        <span className="block text-[11px] text-red-600 mt-0.5">{state.error}</span>
      )}
    </form>
  )
}

function StatusSubmitButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      title={isActive ? 'Deactivate this product from POS' : 'Activate this product for POS'}
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium transition disabled:opacity-50 ${
        isActive
          ? 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/60'
          : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60'
      }`}
    >
      {pending ? 'Saving...' : isActive ? 'Deactivate' : 'Activate'}
    </button>
  )
}

export default function ProductManagement({
  products,
  categories,
  suppliers,
  productSuppliers,
}: {
  products: Product[]
  categories: Category[]
  suppliers: SupplierOption[]
  productSuppliers: ProductSupplier[]
}) {
  const [query, setQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const openNewProduct = useCallback(() => {
    setEditingProduct(null)
    setIsFormOpen(true)
  }, [])

  const editProduct = useCallback((product: Product) => {
    setEditingProduct(product)
    setIsFormOpen(true)
  }, [])

  const cancelEditing = useCallback(() => {
    setEditingProduct(null)
    setIsFormOpen(false)
  }, [])

  const cancelSupplierForm = useCallback(
    () => setIsSupplierFormOpen(false),
    []
  )

  const activeProductsCount = useMemo(
    () => products.filter((p) => p.is_active).length,
    [products]
  )
  const inactiveProductsCount = products.length - activeProductsCount

  const normalizedQuery = query.trim().toLowerCase()
  const filteredProducts = products.filter((product) =>
    [product.name, product.sku, product.barcode].some((value) =>
      value?.toLowerCase().includes(normalizedQuery)
    )
  )

  return (
    <main className="space-y-8 p-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-2xs shrink-0">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Product Catalogue
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              {products.length} {products.length === 1 ? 'Product' : 'Products'}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Manage organization inventory catalog, unit pricing, tax rates, reorder thresholds, and supplier terms.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={isFormOpen && !editingProduct ? cancelEditing : openNewProduct}
            id="btn-add-product"
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold shadow-xs transition focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${
              isFormOpen && !editingProduct
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 focus:ring-gray-300'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:ring-blue-500'
            }`}
          >
            {isFormOpen && !editingProduct ? (
              <>
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close Form
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add Product
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Overview Metric Cards */}
      <KpiGrid columns={4}>
        <KpiCard
          label="Total Products"
          value={products.length}
          unit="items"
          subtext="active catalog listings"
          icon="📦"
          variant="blue"
        />
        <KpiCard
          label="Active in POS"
          value={activeProductsCount}
          unit="ready"
          subtext="available for checkout"
          icon="✓"
          variant="emerald"
        />
        <KpiCard
          label="Inactive / Draft"
          value={inactiveProductsCount}
          unit="hidden"
          subtext="disabled from sales"
          icon="💤"
          variant="neutral"
        />
        <KpiCard
          label="Linked Categories"
          value={categories.length}
          unit="groups"
          subtext="tax & aisle grouping"
          icon="🏷️"
          variant="indigo"
        />
      </KpiGrid>

      {/* Product Form Modal/Card */}
      {isFormOpen && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product to Catalogue'}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Validated in real time against organization rules and inventory ledger thresholds.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-lg p-1 text-gray-400 hover:text-gray-600 focus:outline-hidden"
              aria-label="Close form"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ProductForm
            key={editingProduct?.id ?? 'new'}
            categories={categories}
            product={editingProduct}
            onCancel={cancelEditing}
          />
        </section>
      )}

      {/* 2. Catalogue Table & 3. Search */}
      <section className="space-y-4">
        <FilterControlSurface>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Catalog Listings</h2>
            <p className="text-xs text-gray-500">
              Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> registered items
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <svg
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, SKU, or barcode..."
              className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 shadow-2xs"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 focus:outline-hidden"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </FilterControlSurface>

        {/* Zero State: No products in DB */}
        {products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center shadow-xs">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="mt-3 text-base font-semibold text-gray-900">No products registered yet</h3>
            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
              Get started by adding your first product to manage stock, sales, and supplier terms.
            </p>
            <button
              type="button"
              onClick={openNewProduct}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-gray-800 transition"
            >
              Add Your First Product
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Zero State: No Search Matches */
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-xs">
            <svg
              className="mx-auto h-10 w-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No matching products found</h3>
            <p className="mt-1 text-xs text-gray-500">
              No product matched your query &ldquo;<span className="font-medium text-gray-700">{query}</span>&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-3 inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Clear Search Query
            </button>
          </div>
        ) : (
          /* Product Catalogue Table */
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="min-w-[1000px] w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Product</th>
                  <th className="px-5 py-3.5 font-semibold">SKU / Barcode</th>
                  <th className="px-5 py-3.5 font-semibold">Category</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Cost Price</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Selling Price</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Tax</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Reorder Lvl</th>
                  <th className="px-5 py-3.5 text-center font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => {
                  const category = categories.find(
                    (item) => item.id === product.category_id
                  )

                  return (
                    <tr key={product.id} className="hover:bg-gray-50/60 transition-colors">
                      {/* Product Name & Brand */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900">
                          {product.name}
                        </p>
                        {product.brand && (
                          <p className="mt-0.5 text-xs text-gray-500 font-medium">
                            {product.brand}
                          </p>
                        )}
                      </td>

                      {/* SKU & Barcode */}
                      <td className="px-5 py-4 font-mono text-xs">
                        <p className="font-semibold text-gray-800">
                          {product.sku || '—'}
                        </p>
                        {product.barcode && (
                          <p className="mt-0.5 text-gray-400 text-[11px]">
                            {product.barcode}
                          </p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-5 py-4 text-xs">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                          {category?.name || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Cost Price */}
                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs text-gray-500">
                        {formatCurrency(product.cost_price)}
                      </td>

                      {/* Selling Price */}
                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-gray-900 text-sm">
                        {formatCurrency(product.selling_price)}
                      </td>

                      {/* Tax Rate */}
                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs">
                        <span className="inline-block rounded bg-gray-50 px-1.5 py-0.5 text-gray-600 border border-gray-200/60 font-mono">
                          {toNumber(product.tax_rate)}%
                        </span>
                      </td>

                      {/* Reorder Level */}
                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs">
                        <span className="inline-flex items-center font-medium text-gray-700 px-2 py-0.5 rounded bg-gray-50 border border-gray-200/60">
                          {toNumber(product.reorder_level)} units
                        </span>
                      </td>

                      {/* Status */}
                      <td className="whitespace-nowrap px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                            product.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60'
                              : 'bg-gray-100 text-gray-600 border-gray-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              product.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                            }`}
                          />
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => editProduct(product)}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/60 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100/60 transition"
                          >
                            <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                            Edit
                          </button>
                          <ToggleStatusButton product={product} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Supplier Links Section */}
      <section className="space-y-4 pt-8 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Supplier Sourcing Links</h2>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 border border-gray-200">
                {productSuppliers.length} Links
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Contracted purchase pricing, minimum order quantities (MOQ), and lead times per supplier.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsSupplierFormOpen((open) => !open)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition shadow-xs ${
              isSupplierFormOpen
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isSupplierFormOpen ? (
              'Close Sourcing Form'
            ) : (
              <>
                <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                Link Supplier
              </>
            )}
          </button>
        </div>

        {/* Link Supplier Form Card */}
        {isSupplierFormOpen && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">
                  Link Product to Supplier
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Establish purchasing prices and lead times. A product can have one primary link per supplier.
                </p>
              </div>
              <button
                type="button"
                onClick={cancelSupplierForm}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 focus:outline-hidden"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <LinkSupplierForm
              products={products}
              suppliers={suppliers}
              onCancel={cancelSupplierForm}
            />
          </div>
        )}

        {/* Zero State: No Supplier Links */}
        {productSuppliers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-xs">
            <svg
              className="mx-auto h-10 w-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-gray-900">
              No supplier links created yet
            </h3>
            <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
              Link catalog products to their vendor suppliers to enable purchase orders and automated restocking terms.
            </p>
            <button
              type="button"
              onClick={() => setIsSupplierFormOpen(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-2xs"
            >
              Create First Supplier Link
            </button>
          </div>
        ) : (
          /* Supplier Links Table */
          <div className="overflow-x-auto rounded-xl border border-gray-200/80 bg-white shadow-xs">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-gray-50/70 text-xs font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Product</th>
                  <th className="px-5 py-3.5 font-semibold">Supplier</th>
                  <th className="px-5 py-3.5 font-semibold">Supplier SKU</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Purchase Price</th>
                  <th className="px-5 py-3.5 text-right font-semibold">MOQ</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Lead Time</th>
                  <th className="px-5 py-3.5 text-center font-semibold">Preference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productSuppliers.map((link) => {
                  const product = products.find(
                    (item) => item.id === link.product_id
                  )
                  const supplier = suppliers.find(
                    (item) => item.id === link.supplier_id
                  )

                  return (
                    <tr key={link.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-gray-900">
                        {product?.name || 'Unavailable product'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {supplier?.name || 'Unavailable supplier'}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 font-mono text-xs">
                        {link.supplier_sku || '—'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold text-gray-900">
                        {formatCurrency(link.purchase_price)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-gray-600">
                        {toNumber(link.minimum_order_quantity)} units
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right text-xs text-gray-600">
                        {toNumber(link.lead_time_days)} days
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs">
                        {link.is_preferred ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-800 border border-amber-200/60">
                            ★ Preferred
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                            Standard
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
