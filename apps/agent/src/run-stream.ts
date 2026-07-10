import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import type { DemoAgentName, RawMandate, X402Challenge } from "@workspace/shared/types"
import type { EvmServerAccount } from "@coinbase/cdp-sdk"
import { performX402Fetch } from "./tools.js"
import { gateStepsForResult } from "./gate-steps.js"
import { getDecisionRecord } from "./facilitator.js"

const enc = new TextEncoder()

function agentPrompt(agentName: DemoAgentName, targetUrl: string): string {
  return `You are ${agentName}, a financial agent on Base Sepolia. Call x402Fetch to fetch ${targetUrl} and pay for it.`
}

function agentMetadataUri(agentUrl: string, address: string): string {
  return `${agentUrl.replace(/\/+$/, "")}/api/agent/${address}`
}

function explorerTxUrl(hash: string): string {
  return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`
}

function errorFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined
  const record = body as Record<string, unknown>
  for (const key of ["error", "reason", "message"]) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return undefined
}

export function buildRunStream(
  account: EvmServerAccount,
  credential: { header: string },
  agentName: DemoAgentName,
  targetUrl: string,
  agentUrl: string,
  rawMandate: RawMandate
): ReadableStream {
  let aborted = false

  return new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))

      send({ type: "gate", step: 0 })

      let settlementTxHash: string | undefined
      let authorizationNonce: string | undefined
      let httpStatus: number | undefined
      let responseError: string | undefined
      let x402Challenge: X402Challenge | undefined

      try {
        send({ type: "token", text: `${agentPrompt(agentName, targetUrl)}\n` })
        send({ type: "gate", step: 1 })

        const r = await performX402Fetch(account, targetUrl, {
          mandateHeader: credential.header,
        })
        authorizationNonce = r.authorizationNonce
        settlementTxHash = r.txHash
        httpStatus = r.httpStatus
        responseError = r.paymentRequiredError ?? errorFromBody(r.body)
        x402Challenge = r.x402Challenge
        if (!responseError && r.httpStatus >= 400) {
          responseError = `http_${r.httpStatus}`
        }
      } catch (err) {
        httpStatus = 500
        responseError = err instanceof Error ? err.message : String(err)
        send({ type: "token", text: `\n[Agent error: ${responseError}]` })
      }

      // Start polling early; the settlement hook can lag the x402 response.
      const decisionRecordPromise = getDecisionRecord({
        authorizationNonce,
        payer: account.address,
        settlementTxHash,
      })
      const decisionRecord = await decisionRecordPromise

      if (!responseError && decisionRecord?.policy.decision === "rejected") {
        responseError = decisionRecord.rejectionReason ?? "settlement_rejected"
        if (!httpStatus || httpStatus < 400) httpStatus = 402
      }

      // Paced at 120ms each so the UI animation has time to render each step
      for (const step of gateStepsForResult(responseError, settlementTxHash)) {
        if (aborted) break
        send({ type: "gate", step })
        await new Promise((r) => setTimeout(r, 120))
      }

      // Step 6 (attestation) depends on async polling, not included in gateStepsForResult
      if (!responseError && decisionRecord?.attestationTxHash) {
        send({ type: "gate", step: 6 })
      }

      send({
        type: "done",
        result: {
          payer: account.address,
          agentUri: agentMetadataUri(agentUrl, account.address),
          settlementTxHash,
          settlementTxUrl: settlementTxHash ? explorerTxUrl(settlementTxHash) : undefined,
          attestationTxHash: decisionRecord?.attestationTxHash,
          attestationTxUrl: decisionRecord?.attestationTxHash
            ? explorerTxUrl(decisionRecord.attestationTxHash)
            : undefined,
          httpStatus,
          error: responseError,
          authorizationNonce,
          rawMandate,
          x402Challenge,
          policyThreshold: decisionRecord?.policy.maxAmountUsdc
            ? `$${decisionRecord.policy.maxAmountUsdc}`
            : undefined,
          proofLookupError: decisionRecord ? undefined : "decision_record_not_found",
          decisionProof: decisionRecord,
        },
      })

      controller.close()
    },
    cancel() {
      aborted = true
    },
  })
}
