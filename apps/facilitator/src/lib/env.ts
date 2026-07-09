import { DEMO_POLICY_MAX_AMOUNT_USDC } from "@workspace/shared/demo"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

const hexString = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && value.startsWith("0x"),
  "Expected a 0x-prefixed hex string",
)

export const env = createEnv({
  server: {
    FACILITATOR_PRIVATE_KEY: hexString,
    ATTESTATION_REGISTRY_ADDRESS: hexString,
    POLICY_MAX_AMOUNT_USDC: z.coerce.number().default(DEMO_POLICY_MAX_AMOUNT_USDC),
    PORT: z.coerce.number().default(3001),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
