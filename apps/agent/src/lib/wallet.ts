import { CdpClient } from "@coinbase/cdp-sdk"

// Account name used for deterministic wallet identity across runs.
// The same name always resolves to the same CDP server account.
const AGENT_ACCOUNT_NAME = "metal-agent"

let _client: CdpClient | null = null

function getClient(): CdpClient {
  if (!_client) {
    // Reads CDP_API_KEY_NAME (or CDP_API_KEY_ID), CDP_API_KEY_SECRET,
    // and CDP_WALLET_SECRET automatically from environment variables.
    _client = new CdpClient()
  }
  return _client
}

// Returns the agent's EVM server account, creating it on first run.
// Subsequent calls return the same account (deterministic by name + wallet secret).
// The returned EvmServerAccount is viem-compatible: address, signMessage, signTypedData, signTransaction.
export async function getAgentAccount() {
  const cdp = getClient()
  return cdp.evm.getOrCreateAccount({ name: AGENT_ACCOUNT_NAME })
}
