import { parsePaymentPayload, parsePaymentRequirements } from "@x402/core/schemas"
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types"
import type { Context } from "hono"
import { isRecord, parseBigIntField, readJsonObject } from "./http.js"

export async function readPaymentBody(c: Context) {
  const body = await readJsonObject(c)
  if (body instanceof Response) return body
  if (!isRecord(body.paymentPayload) || !isRecord(body.paymentRequirements)) {
    return c.json({ error: "paymentPayload and paymentRequirements are required" }, 400)
  }

  const payloadResult = parsePaymentPayload(body.paymentPayload)
  if (!payloadResult.success) return c.json({ error: "paymentPayload is invalid", issues: payloadResult.error.issues }, 400)
  if (payloadResult.data.x402Version !== 2) return c.json({ error: "paymentPayload.x402Version must be 2" }, 400)

  const reqResult = parsePaymentRequirements(body.paymentRequirements)
  if (!reqResult.success) return c.json({ error: "paymentRequirements is invalid", issues: reqResult.error.issues }, 400)
  if (!("amount" in reqResult.data)) return c.json({ error: "paymentRequirements.amount is required" }, 400)
  const amount = parseBigIntField(reqResult.data.amount, "paymentRequirements.amount")
  if (typeof amount === "string") return c.json({ error: amount }, 400)

  return {
    paymentPayload: payloadResult.data as unknown as PaymentPayload,
    paymentRequirements: {
      ...reqResult.data,
      network: reqResult.data.network as PaymentRequirements["network"],
      extra: reqResult.data.extra ?? {},
    } as PaymentRequirements,
  }
}
