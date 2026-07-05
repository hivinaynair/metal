import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    PAYER_PRIVATE_KEY: z.string().startsWith("0x"),
    RECIPIENT_PRIVATE_KEY: z.string().startsWith("0x"),
    PAY_TO_ADDRESS: z.string().startsWith("0x"),
  },
  client: {},
  runtimeEnv: {
    PAYER_PRIVATE_KEY: process.env.PAYER_PRIVATE_KEY,
    RECIPIENT_PRIVATE_KEY: process.env.RECIPIENT_PRIVATE_KEY,
    PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
  },
  emptyStringAsUndefined: true,
});
