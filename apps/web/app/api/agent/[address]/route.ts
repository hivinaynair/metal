import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { env } from "@/env"

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  return NextResponse.redirect(new URL(`/api/agent/${address}`, env.AGENT_URL))
}
