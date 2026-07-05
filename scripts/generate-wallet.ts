import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { setEnvVar } from "./lib/env"

const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)
const varName = process.argv[2] ?? "PAYER_PRIVATE_KEY"

setEnvVar(varName, privateKey)
console.log("Address:", account.address)
