export function formatUsdc(usdc: bigint): string {
  return (Number(usdc) / 1_000_000).toFixed(2)
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function shortAddress(value?: string): string {
  if (!value || !value.startsWith("0x")) return value ?? "pending"
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}
