import { lookupIdentity } from "@workspace/shared/identity"
import { ERC8004_REGISTRY_ADDRESS } from "@workspace/shared/chains"
import { publicClient } from "./clients.js"
import { verifyMandateSignature } from "./mandate.js"
import type { VerifyDeps } from "./validate-mandate.js"

export const verifyDeps: VerifyDeps = {
  verifyMandateSignature,
  lookupIdentity,
  registryAddress: ERC8004_REGISTRY_ADDRESS,
  client: publicClient,
}
