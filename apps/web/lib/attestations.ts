import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { ATTESTED_EVENT } from "@workspace/shared/abis"
import { BASE_SEPOLIA_EXPLORER } from "@workspace/shared/chains"
import { env } from "@/env"

export interface AttestationRow {
  paymentHash: string
  payer: string
  amountUsdc: bigint
  identityStatus: number
  decision: number
  timestamp: number
  txHash: string
  attestationTx: string
}

// Base Sepolia RPC limits getLogs to 2000 blocks per query
const BLOCK_LOOKBACK = 2000n

export async function getAttestations(): Promise<AttestationRow[]> {
  const client = createPublicClient({ chain: baseSepolia, transport: http() })

  const latestBlock = await client.getBlockNumber()
  const fromBlock = latestBlock > BLOCK_LOOKBACK ? latestBlock - BLOCK_LOOKBACK : 0n

  const logs = await client.getLogs({
    address: env.ATTESTATION_REGISTRY_ADDRESS as `0x${string}`,
    event: ATTESTED_EVENT,
    fromBlock,
    toBlock: latestBlock,
  })

  return logs.map((log) => {
    const { paymentHash, payer, amountUsdc, identityStatus, decision, timestamp } = log.args as {
      paymentHash: `0x${string}`
      payer: `0x${string}`
      amountUsdc: bigint
      identityStatus: number
      decision: number
      timestamp: bigint
    }
    return {
      paymentHash,
      payer,
      amountUsdc,
      identityStatus,
      decision,
      timestamp: Number(timestamp),
      txHash: log.transactionHash ?? "",
      attestationTx: log.transactionHash
        ? `${BASE_SEPOLIA_EXPLORER}/tx/${log.transactionHash}`
        : "",
    }
  })
}
