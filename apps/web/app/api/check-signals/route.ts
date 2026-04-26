import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { runSignalCheck } from "@/lib/signals"

export async function POST(request: NextRequest) {
  let body: { symbol: string; source: string; tf?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { symbol, source, tf } = body
  if (!symbol || !source) {
    return NextResponse.json(
      { error: "symbol and source are required" },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()
  const result = await runSignalCheck({ supabase, symbol, source, tf })
  return NextResponse.json(result)
}
