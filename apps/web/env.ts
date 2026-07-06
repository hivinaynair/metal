import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    PAY_TO_ADDRESS: z.string().startsWith("0x"),
    FACILITATOR_URL: z.string().url(),
  },
  client: {},
  runtimeEnv: {
    PAY_TO_ADDRESS: process.env.PAY_TO_ADDRESS,
    FACILITATOR_URL: process.env.FACILITATOR_URL,
  },
  emptyStringAsUndefined: true,
});
