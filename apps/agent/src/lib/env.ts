const required = (key: string): string => {
  const val = process.env[key]
  if (!val) throw new Error(`Missing env var: ${key}`)
  return val
}

export const env = {
  // Anthropic — for Claude
  ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),

  // App endpoints
  APP_URL: required("APP_URL"),
  FACILITATOR_URL: process.env.FACILITATOR_URL ?? "https://x402.org/facilitator",

  // ERC-8004 agentId — set after first run (empty string = not yet registered)
  AGENT_ID: process.env.AGENT_ID ?? "",
}

// CDP credentials are NOT exposed here — CdpClient reads CDP_API_KEY_NAME (or CDP_API_KEY_ID)
// automatically; CdpEvmWalletProvider in tools.ts passes them explicitly from process.env.
