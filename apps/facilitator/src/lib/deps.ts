import { lookupIdentity } from "@workspace/shared/identity"
import { publicClient } from "./clients.ts"
import { env } from "./env.ts"
import { getMandate } from "./mandate-store.ts"
import { verifyMandateSignature } from "./mandate.ts"
import type { VerifyDeps } from "../hooks/verify.ts"

export const verifyDeps: VerifyDeps = {
  getMandate,
  verifyMandateSignature,
  lookupIdentity,
  registryAddress: env.IDENTITY_REGISTRY_ADDRESS,
  client: publicClient,
}
