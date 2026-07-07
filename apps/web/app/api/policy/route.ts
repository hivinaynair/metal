import { NextResponse } from "next/server"
import { env } from "@/env"

export async function GET() {
  const res = await fetch(`${env.FACILITATOR_URL}/policy`)
  const data = await res.json()
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const res = await fetch(`${env.FACILITATOR_URL}/policy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
