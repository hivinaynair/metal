import { parsePaymentPayload, parsePaymentRequirements } from "@x402/core/schemas"
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types"
import type { Context } from "hono"
import { isRecord, parseBigIntField, readJsonObject } from "./http.js"

type ParsedPaymentRequirements = {
  scheme: string
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  extra?: Record<string, unknown> | null
}

type RawPaymentPayload = {
  x402Version: 2
  resource?: PaymentPayload["resource"]
  accepted: ParsedPaymentRequirements
  payload: Record<string, unknown>
  extensions?: Record<string, unknown> | null
}

export function normalizeRequirements(requirements: ParsedPaymentRequirements): PaymentRequirements {
  return {
    ...requirements,
    network: requirements.network as PaymentRequirements["network"],
    extra: requirements.extra ?? {},
  }
}

function normalizePaymentPayload(payload: RawPaymentPayload): PaymentPayload {
  return {
    x402Version: payload.x402Version,
    ...(payload.resource ? { resource: payload.resource } : {}),
    accepted: normalizeRequirements(payload.accepted),
    payload: payload.payload,
    ...(payload.extensions ? { extensions: payload.extensions } : {}),
  }
}

function parsePayload(raw: unknown, c: Context): RawPaymentPayload | Response {
  const result = parsePaymentPayload(raw)
  if (!result.success) return c.json({ error: "paymentPayload is invalid", issues: result.error.issues }, 400)
  if (result.data.x402Version !== 2) return c.json({ error: "paymentPayload.x402Version must be 2" }, 400)
  return result.data as RawPaymentPayload
}

function parseRequirements(raw: unknown, c: Context): ParsedPaymentRequirements | Response {
  const result = parsePaymentRequirements(raw)
  if (!result.success) return c.json({ error: "paymentRequirements is invalid", issues: result.error.issues }, 400)
  if (!("amount" in result.data)) return c.json({ error: "paymentRequirements.amount is required" }, 400)
  const amount = parseBigIntField(result.data.amount, "paymentRequirements.amount")
  if (typeof amount === "string") return c.json({ error: amount }, 400)
  return result.data as ParsedPaymentRequirements
}

export async function readPaymentBody(c: Context) {
  const body = await readJsonObject(c)
  if (body instanceof Response) return body
  if (!isRecord(body.paymentPayload) || !isRecord(body.paymentRequirements)) {
    return c.json({ error: "paymentPayload and paymentRequirements are required" }, 400)
  }

  const payload = parsePayload(body.paymentPayload, c)
  if (payload instanceof Response) return payload

  const requirements = parseRequirements(body.paymentRequirements, c)
  if (requirements instanceof Response) return requirements

  return {
    paymentPayload: normalizePaymentPayload(payload),
    paymentRequirements: normalizeRequirements(requirements),
  }
}
