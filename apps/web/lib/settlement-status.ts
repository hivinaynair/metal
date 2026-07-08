import { MANDATE_FAILURES, isMandateFailure } from "@workspace/shared/settlement-errors"

export { isMandateFailure }

export function settlementFailureStep(error?: string | null) {
  if (error === "identity_not_found") return 2
  if (error && MANDATE_FAILURES.has(error)) return 3
  if (error === "policy_amount_exceeded") return 4
  return error ? 4 : 0
}

export function resultFailureStep(result: {
  body?: { error?: string }
  mandateValid?: boolean | null
}) {
  if (result.mandateValid === false) return 3
  return settlementFailureStep(result.body?.error) || 4
}

export function cleanRejectionReason(error?: string | null) {
  if (!error) return null
  const trimmed = error.trim()
  if (/^(<!doctype html|<html)/i.test(trimmed)) {
    const title = trimmed
      .match(/<title[^>]*>(.*?)<\/title>/is)?.[1]
      ?.replace(/\s+/g, " ")
      .trim()
    return title
      ? `Upstream returned HTML: ${title}`
      : "Upstream returned an HTML error page"
  }
  return trimmed.length > 240 ? `${trimmed.slice(0, 240)}...` : trimmed
}
