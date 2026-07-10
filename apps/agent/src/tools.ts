import { tool } from "ai"
import { z } from "zod"
import { wrapFetchWithPaymentFromConfig, decodePaymentResponseHeader } from "@x402/fetch"
import { decodePaymentRequiredHeader, decodePaymentSignatureHeader } from "@x402/core/http"
import { ExactEvmScheme } from "@x402/evm"
import { BASE_SEPOLIA_CAIP2, BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import type { EvmServerAccount } from "@coinbase/cdp-sdk"
import type { X402Challenge } from "@workspace/shared/types"

function summarizeNonJsonResponse(url: string, response: Response, text: string) {
  const contentType = response.headers.get("content-type") ?? "unknown content type"
  const title = text.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]
    ?.replace(/\s+/g, " ")
    .trim()

  if (contentType.includes("text/html") || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
    return title
      ? `Upstream returned HTML for ${url} (${response.status} ${response.statusText}): ${title}`
      : `Upstream returned HTML for ${url} (${response.status} ${response.statusText})`
  }

  const summary = text.replace(/\s+/g, " ").trim()
  return summary
    ? `Upstream returned ${response.status} ${response.statusText} for ${url}: ${summary.slice(0, 240)}`
    : `Upstream returned ${contentType} for ${url} (${response.status} ${response.statusText})`
}

function extractAuthorizationNonce(paymentPayload: unknown) {
  const payload = (paymentPayload as { payload?: unknown }).payload as Record<string, unknown> | undefined
  const authorization = payload?.authorization as Record<string, unknown> | undefined
  return typeof authorization?.nonce === "string" ? authorization.nonce : undefined
}

export interface X402FetchResult {
  httpStatus: number
  body: unknown
  txHash?: string
  authorizationNonce?: string
  paymentRequiredError?: string
  basescan?: string
  x402Challenge?: X402Challenge
}

export async function performX402Fetch(
  cdpAccount: EvmServerAccount,
  url: string,
  opts?: { mandateHeader?: string },
): Promise<X402FetchResult> {
  let authorizationNonce: string | undefined
  let x402Challenge: X402Challenge | undefined
  const observingFetch: typeof fetch = async (input, init) => {
    const request = new Request(input, init)
    const paymentSignature = request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT")
    if (paymentSignature) {
      try {
        authorizationNonce = extractAuthorizationNonce(decodePaymentSignatureHeader(paymentSignature))
      } catch {
        authorizationNonce = undefined
      }
    }
    const response = await fetch(request)
    if (response.status === 402 && !x402Challenge) {
      const header = response.headers.get("PAYMENT-REQUIRED") ?? response.headers.get("X-PAYMENT-REQUIRED")
      if (header) {
        try {
          const decoded = decodePaymentRequiredHeader(header) as Record<string, unknown>
          const resource = decoded.resource
          x402Challenge = {
            scheme: decoded.scheme as string | undefined,
            network: decoded.network as string | undefined,
            maxAmountRequired: decoded.maxAmountRequired as string | undefined,
            resource: typeof resource === "object" && resource !== null
              ? ((resource as Record<string, unknown>).url as string | undefined)
              : resource as string | undefined,
            description: decoded.description as string | undefined,
          }
        } catch { /* ignore decode errors */ }
      }
    }
    return response
  }

  const fetchWithPayment = wrapFetchWithPaymentFromConfig(observingFetch, {
    schemes: [
      {
        network: BASE_SEPOLIA_CAIP2,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: new ExactEvmScheme(cdpAccount as any),
      },
    ],
  })

  const headers: Record<string, string> = {}
  if (opts?.mandateHeader) headers["X-AP2-Mandate"] = opts.mandateHeader

  const response = await fetchWithPayment(url, Object.keys(headers).length ? { headers } : undefined)
  const paymentHeader = response.headers.get("PAYMENT-RESPONSE")
  const paymentRequiredHeader = response.headers.get("PAYMENT-REQUIRED") ?? response.headers.get("X-PAYMENT-REQUIRED")
  let txHash: string | undefined
  let paymentRequiredError: string | undefined

  if (paymentHeader) {
    const decoded = decodePaymentResponseHeader(paymentHeader)
    const d = decoded as Record<string, unknown>
    txHash = (d.transaction as string | undefined) ?? (d.txHash as string | undefined)
  }
  if (paymentRequiredHeader) {
    const decoded = decodePaymentRequiredHeader(paymentRequiredHeader)
    paymentRequiredError = decoded.error
  }

  let body: unknown
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    body = await response.json()
  } else {
    body = { error: summarizeNonJsonResponse(url, response, await response.text()) }
  }

  return {
    httpStatus: response.status,
    body,
    txHash,
    authorizationNonce,
    paymentRequiredError,
    basescan: txHash ? `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}` : undefined,
    x402Challenge,
  }
}

// Build tools for the agent. Keep this narrow so optional AgentKit providers are not loaded at startup.
export async function buildTools(cdpAccount: EvmServerAccount, opts?: { mandateHeader?: string }) {
  const x402FetchTool = tool({
    description:
      "Fetch a URL that may be gated behind an x402 paywall. Handles payment automatically. Returns the response body, HTTP status, and the transaction hash if payment was made.",
    parameters: z.object({
      url: z.string().describe("The URL to fetch"),
    }),
    execute: async ({ url }) => {
      return performX402Fetch(cdpAccount, url, opts)
    },
  })

  return { x402Fetch: x402FetchTool }
}
