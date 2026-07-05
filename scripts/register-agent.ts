import { getPublicClient, getWalletClient } from "./lib/clients"
import artifact from "../contracts/artifacts/IdentityRegistry.json"

const facilitatorKey = process.env.FACILITATOR_PRIVATE_KEY
const payerKey = process.env.PAYER_PRIVATE_KEY
const registryAddress = process.env.IDENTITY_REGISTRY_ADDRESS

if (!facilitatorKey || !payerKey || !registryAddress) {
  throw new Error("Missing: FACILITATOR_PRIVATE_KEY, PAYER_PRIVATE_KEY, or IDENTITY_REGISTRY_ADDRESS")
}

const { account: facilitator, client: walletClient } = getWalletClient(facilitatorKey as `0x${string}`)
const { account: payer } = getWalletClient(payerKey as `0x${string}`)
const publicClient = getPublicClient()

console.log(`Registering agent: ${payer.address}`)

// Name and URI are intentional demo fixtures — not parameterized
const hash = await walletClient.writeContract({
  address: registryAddress as `0x${string}`,
  abi: artifact.abi,
  functionName: "register",
  args: [payer.address, "Demo Agent", "https://metal-demo.vercel.app/agent"],
})

await publicClient.waitForTransactionReceipt({ hash })
console.log(`✓ Registered ${payer.address}`)
console.log(`  https://sepolia.basescan.org/tx/${hash}`)
