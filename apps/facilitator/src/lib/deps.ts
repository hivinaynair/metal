import { lookupIdentity } from "@workspace/shared/identity"
import { publicClient } from "./clients.js"
import { env } from "./env.js"
import { getMandate } from "./mandate-store.js"
import { verifyMandateSignature } from "./mandate.js"
import type { VerifyDeps } from "../hooks/verify.js"

export const verifyDeps: VerifyDeps = {
  getMandate,
  verifyMandateSignature,
  lookupIdentity,
  registryAddress: env.IDENTITY_REGISTRY_ADDRESS,
  client: publicClient,
}
