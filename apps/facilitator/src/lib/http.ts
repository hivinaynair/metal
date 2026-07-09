import type { Context } from "hono"
import { z } from "zod"

export type JsonObject = Record<string, unknown>

const JsonObjectSchema = z.record(z.unknown())

export function isRecord(value: unknown): value is JsonObject {
  return JsonObjectSchema.safeParse(value).success
}

export async function readJsonObject(c: Context): Promise<JsonObject | Response> {
  try {
    const body = await c.req.json()
    const result = JsonObjectSchema.safeParse(body)
    if (!result.success) return c.json({ error: "request body must be a JSON object" }, 400)
    return result.data
  } catch {
    return c.json({ error: "invalid JSON body" }, 400)
  }
}

const BigIntSchema = z.coerce.bigint().nonnegative()

export function parseBigIntField(value: unknown, field: string): bigint | string {
  const result = BigIntSchema.safeParse(value)
  if (!result.success) return `${field} must be a non-negative integer`
  return result.data
}
