import { env } from "@/env"

export async function fetchPolicyMax(): Promise<number> {
  try {
    const res = await fetch(`${env.FACILITATOR_URL}/policy`, { cache: "no-store" })
    const data = await res.json() as { maxAmountUsdc?: number }
    return typeof data.maxAmountUsdc === "number" ? data.maxAmountUsdc : 2
  } catch {
    return 2
  }
}
