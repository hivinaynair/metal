# Scripts Bun App Design

## Context

The `scripts/` workspace contains CLI tools for contract compilation/deployment, wallet generation, and mandate management. Currently scripts are run via `cd ..` hacks in `scripts/package.json`, which is awkward. The goal is to make them runnable cleanly from the repo root as `bun run scripts:<name>`, with env auto-loaded from `scripts/.env.local`.

Additionally, `scripts/lib/env.ts` provides `setEnvVar` to write generated values back to `.env.local`. We're removing this — scripts will print generated values to stdout instead, and the user manually adds them to `.env.local`.

## Design

### Root `package.json` — add namespaced script entries

```json
"scripts:compile-contracts": "bun --env-file=scripts/.env.local scripts/compile-contracts.ts",
"scripts:deploy-contracts":  "bun --env-file=scripts/.env.local scripts/deploy-contracts.ts",
"scripts:fund-wallet":       "bun --env-file=scripts/.env.local scripts/fund-wallet.ts",
"scripts:generate-wallet":   "bun --env-file=scripts/.env.local scripts/generate-wallet.ts",
"scripts:register-mandate":  "bun --env-file=scripts/.env.local scripts/register-mandate.ts",
"scripts:sign-mandate":      "bun --env-file=scripts/.env.local scripts/sign-mandate.ts",
"scripts:test":              "bun --env-file=scripts/.env.local test scripts"
```

### `scripts/package.json` — strip all `scripts` entries

Remove all script entries (they were all cd hacks). Keep `dependencies`.

### `scripts/lib/env.ts` — delete

No longer needed.

### `scripts/generate-wallet.ts` — remove `setEnvVar`, print key to stdout

```ts
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"

const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)
const varName = process.argv[2] ?? "PAYER_PRIVATE_KEY"

console.log(`${varName}=${privateKey}`)
console.log("Address:", account.address)
console.log("Add the above line to scripts/.env.local")
```

### `scripts/deploy-contracts.ts` — remove `setEnvVar`, print address to stdout

Replace `setEnvVar("ATTESTATION_REGISTRY_ADDRESS", attestationAddr)` with:
```ts
console.log(`ATTESTATION_REGISTRY_ADDRESS=${attestationAddr}`)
console.log("Add the above line to scripts/.env.local")
```

## Verification

- `bun run scripts:generate-wallet` from repo root — prints private key + address
- `bun run scripts:compile-contracts` — compiles contracts
- `bun run scripts:fund-wallet` — funds wallet using env from `scripts/.env.local`
- `bun run scripts:test` — runs tests in scripts/
