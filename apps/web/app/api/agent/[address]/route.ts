import { NextRequest, NextResponse } from "next/server"

// ERC-8004 agent descriptor — https://eips.ethereum.org/EIPS/eip-8004
// agentURI registered on-chain points here; swap hardcoded values for DB lookup later
const AGENT_NAME = "Metal Agent"
const AGENT_VERSION = "1.0.0"
const AGENT_CAPABILITIES = ["payment", "settlement"]

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  return NextResponse.json({
    address,
    name: AGENT_NAME,
    version: AGENT_VERSION,
    capabilities: AGENT_CAPABILITIES,
  })
}
