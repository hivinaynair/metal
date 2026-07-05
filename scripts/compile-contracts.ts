import solc from "solc"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { resolve } from "path"

const root = process.cwd()

function compile(name: string) {
  const source = readFileSync(resolve(root, `contracts/${name}.sol`), "utf8")
  const input = {
    language: "Solidity",
    sources: { [`${name}.sol`]: { content: source } },
    settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } } },
  }
  const output = JSON.parse(solc.compile(JSON.stringify(input)))
  const errors = output.errors?.filter((e: { severity: string }) => e.severity === "error")
  if (errors?.length) {
    console.error(errors)
    process.exit(1)
  }
  const contract = output.contracts[`${name}.sol`][name]
  return { abi: contract.abi, bytecode: contract.evm.bytecode.object }
}

mkdirSync(resolve(root, "contracts/artifacts"), { recursive: true })

const identity = compile("IdentityRegistry")
writeFileSync(resolve(root, "contracts/artifacts/IdentityRegistry.json"), JSON.stringify(identity, null, 2))
console.log("✓ IdentityRegistry compiled")

const attestation = compile("AttestationRegistry")
writeFileSync(resolve(root, "contracts/artifacts/AttestationRegistry.json"), JSON.stringify(attestation, null, 2))
console.log("✓ AttestationRegistry compiled")
