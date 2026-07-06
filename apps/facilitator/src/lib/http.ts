import type { Context } from "hono"

export type JsonObject = Record<string, unknown>

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function readJsonObject(c: Context): Promise<JsonObject | Response> {
  try {
    const body = await c.req.json()
    if (!isRecord(body)) return c.json({ error: "request body must be a JSON object" }, 400)
    return body
  } catch {
    return c.json({ error: "invalid JSON body" }, 400)
  }
}

export function parseBigIntField(value: unknown, field: string): bigint | string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return `${field} must be an integer`
  }

  try {
    const parsed = BigInt(value)
    return parsed >= 0n ? parsed : `${field} must be non-negative`
  } catch {
    return `${field} must be an integer`
  }
}
