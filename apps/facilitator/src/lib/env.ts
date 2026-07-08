import { DEMO_POLICY_MAX_AMOUNT_USDC } from "@workspace/shared/demo"

const required = (key: string): string => {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

export const env = {
  FACILITATOR_PRIVATE_KEY: required("FACILITATOR_PRIVATE_KEY") as `0x${string}`,
  ATTESTATION_REGISTRY_ADDRESS: required("ATTESTATION_REGISTRY_ADDRESS") as `0x${string}`,
  POLICY_MAX_AMOUNT_USDC: Number(process.env.POLICY_MAX_AMOUNT_USDC ?? DEMO_POLICY_MAX_AMOUNT_USDC),
  PORT: Number(process.env.PORT ?? "3001"),
}
