import type { DecisionRecord } from "@workspace/shared/types"

// Poll facilitator for its canonical decision record. The settlement hook can lag the x402 response.
export async function getDecisionRecord(
  {
    authorizationNonce,
    payer,
    settlementTxHash,
  }: {
    authorizationNonce?: string
    payer: string
    settlementTxHash?: string
  },
  retries = 5
): Promise<DecisionRecord | undefined> {
  const baseUrl = process.env.FACILITATOR_URL?.replace(/\/+$/, "")
  if (!baseUrl) return undefined

  for (let i = 0; i < retries; i++) {
    const path = settlementTxHash
      ? `/decision-records/by-settlement/${settlementTxHash}`
      : authorizationNonce
        ? `/decision-records/by-auth-nonce/${encodeURIComponent(authorizationNonce)}`
        : `/decision-records/latest?payer=${encodeURIComponent(payer.toLowerCase())}`
    const response = await fetch(`${baseUrl}${path}`).catch(() => undefined)
    const body = response?.ok
      ? ((await response.json().catch(() => undefined)) as
          { decisionRecord?: DecisionRecord | null } | undefined)
      : undefined
    if (body?.decisionRecord) return body.decisionRecord
    if (i < retries - 1) await new Promise((r) => setTimeout(r, 800))
  }
  return undefined
}
