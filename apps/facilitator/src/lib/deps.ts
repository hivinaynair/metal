import { lookupIdentity } from "@workspace/shared/identity"
import { ERC8004_ADDRESS } from "@workspace/shared/abis"
import { publicClient } from "./clients.ts"
import { getMandate } from "./mandate-store.ts"
import { verifyMandateSignature } from "./mandate.ts"
import type { VerifyDeps } from "../hooks/verify.ts"

export const verifyDeps: VerifyDeps = {
  getMandate,
  verifyMandateSignature,
  lookupIdentity,
  registryAddress: ERC8004_ADDRESS,
  client: publicClient,
}
