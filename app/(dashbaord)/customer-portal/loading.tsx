export default function CustomerPortalLoading() {
  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Customer Portal</h1>
        <p className="mt-1 text-sm text-gray-600">Loading your account...</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-lg border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
    </main>
  )
}
