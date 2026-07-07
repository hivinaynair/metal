export function TopStatus() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex overflow-hidden rounded-md border border-border bg-card">
        <div className="border-r border-border px-4 py-2">
          <p className="metal-eyebrow">Network</p>
          <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Base Sepolia
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="metal-eyebrow">Environment</p>
          <p className="mt-1 text-sm font-semibold">Testnet</p>
        </div>
      </div>
    </div>
  )
}
