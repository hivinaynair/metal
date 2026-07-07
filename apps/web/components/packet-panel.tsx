import { cn } from "@workspace/ui/lib/utils"

export function PacketPanel({
  amount,
  from,
  mandate,
  policy,
}: {
  amount: string
  from: string
  mandate: string
  policy: string
}) {
  const rows = [
    ["Amount", `${amount.replace("$", "")} USDC`],
    ["From", from],
    ["To", "0xMetal…9E21"],
    ["Mandate", mandate],
    ["Policy", policy],
    ["Created", "14:23:10.912Z"],
  ]

  return (
    <div className="grid">
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className={cn(
            "flex items-center justify-between gap-4 py-3 text-sm",
            index < rows.length - 1 && "border-b border-border"
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="text-right font-mono text-foreground">{value}</span>
        </div>
      ))}
    </div>
  )
}
