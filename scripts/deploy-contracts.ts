import { readFileSync } from "fs"
import { resolve } from "path"
import { createPublicClient, createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { baseSepolia } from "viem/chains"

const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY
if (!facilitatorKey) throw new Error("FACILITATOR_PRIVATE_KEY not set")

const account = privateKeyToAccount(facilitatorKey as `0x${string}`)
const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http() })
const publicClient = createPublicClient({ chain: baseSepolia, transport: http() })

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

console.log(`ATTESTATION_REGISTRY_ADDRESS=${attestationAddr}`)
console.log("↳ Add the above line to scripts/.env.local")
