import { readFileSync } from "fs"
import { resolve } from "path"
import { getPublicClient, getWalletClient } from "./lib/clients"
import { setEnvVar } from "./lib/env"

const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY
if (!facilitatorKey) throw new Error("FACILITATOR_PRIVATE_KEY not set")

const { account, client: walletClient } = getWalletClient(facilitatorKey as `0x${string}`)
const publicClient = getPublicClient()

console.log(`Deploying from: ${account.address}`)

async function deploy(name: string): Promise<`0x${string}`> {
  const { abi, bytecode } = JSON.parse(
    readFileSync(resolve(process.cwd(), `contracts/artifacts/${name}.json`), "utf8")
  )
  const hash = await walletClient.deployContract({ abi, bytecode: `0x${bytecode}`, account })
  console.log(`  ${name} tx: ${hash}`)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  if (!receipt.contractAddress) throw new Error(`${name} deploy failed — no contract address`)
  console.log(`✓ ${name}: ${receipt.contractAddress}`)
  console.log(`  https://sepolia.basescan.org/address/${receipt.contractAddress}`)
  return receipt.contractAddress
}

const attestationAddr = await deploy("AttestationRegistry")

setEnvVar("ATTESTATION_REGISTRY_ADDRESS", attestationAddr)
console.log("✓ Address written to .env.local")
