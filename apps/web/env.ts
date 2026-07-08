import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    PAY_TO_ADDRESS: z.string().startsWith("0x"),
    FACILITATOR_URL: z.string().url(),
    AGENT_URL: z.string().url(),
    APP_URL: z.string().url(),
    ATTESTATION_REGISTRY_ADDRESS: z.string().startsWith("0x"),
    DATABASE_URL: z.string().url(),
  },
  client: {},
  runtimeEnv: {
    PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
    FACILITATOR_URL: process.env.FACILITATOR_URL,
    AGENT_URL: process.env.AGENT_URL,
    APP_URL: process.env.APP_URL,
    ATTESTATION_REGISTRY_ADDRESS: process.env.ATTESTATION_REGISTRY_ADDRESS,
    DATABASE_URL: process.env.DATABASE_URL,
  },
  emptyStringAsUndefined: true,
});
