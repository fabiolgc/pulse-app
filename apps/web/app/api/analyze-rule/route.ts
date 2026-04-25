import { NextRequest, NextResponse } from "next/server"
import { interpretRule } from "@/lib/claude"
import { z } from "zod/v4"

const requestSchema = z.object({
  description: z.string().min(1),
  symbol: z.string().optional(),
  timeframe: z.string().optional(),
})

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    )
  }

  try {
    const ruleLogic = await interpretRule({
      description: parsed.data.description,
      symbol: parsed.data.symbol,
      timeframe: parsed.data.timeframe,
    })

    return NextResponse.json({ ok: true, logic: ruleLogic })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to interpret rule"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
