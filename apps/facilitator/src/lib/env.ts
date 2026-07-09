import { DEMO_POLICY_MAX_AMOUNT_USDC } from "@workspace/shared/demo"
import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"


export const env = createEnv({

  server: {
    FACILITATOR_PRIVATE_KEY: z.string(),
    ATTESTATION_REGISTRY_ADDRESS: z.string(),
    POLICY_MAX_AMOUNT_USDC: z.coerce.number().default(DEMO_POLICY_MAX_AMOUNT_USDC),
    PORT: z.coerce.number().default(3001),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
})
