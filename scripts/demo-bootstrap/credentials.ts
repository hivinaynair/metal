import { schema } from "@workspace/shared/db"
import { toSerializedMandateHeader } from "@workspace/shared/mandate-header"
import type { DemoAgentName } from "@workspace/shared/types"
import { AP2_CREDENTIAL_TYPE } from "./config.js"
import type { Database } from "./context.js"
import type { SignedMandateForBootstrap } from "./types.js"

export async function upsertAgentCredential({
  db,
  agentName,
  addressLower,
  onChainAgentId,
  mandate,
}: {
  db: Database
  agentName: DemoAgentName
  addressLower: string
  onChainAgentId: bigint
  mandate: SignedMandateForBootstrap
}) {
  const credentialJson = toSerializedMandateHeader({
    agentId: onChainAgentId,
    mandate,
  })

  await db
    .insert(schema.agentCredentials)
    .values({
      agentAddress: addressLower,
      agentName,
      credentialType: AP2_CREDENTIAL_TYPE,
      credentialJson,
      expiresAt: mandate.payload.expiry,
    })
    .onConflictDoUpdate({
      target: [
        schema.agentCredentials.agentAddress,
        schema.agentCredentials.credentialType,
      ],
      set: {
        agentName,
        credentialJson,
        expiresAt: mandate.payload.expiry,
      },
    })
}
