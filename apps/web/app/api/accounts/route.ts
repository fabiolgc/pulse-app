import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { generateAccountToken, hashAccountToken } from "@/lib/account-token"
import { buildAgentPackage } from "@/lib/agent-package"

const createSchema = z.object({
  label: z.string().min(1).max(80),
  broker: z.enum(["xp", "hantec", "other"]),
  account_type: z.enum(["real", "demo"]),
  mt5_path: z.string().max(500).optional().nullable(),
  symbols: z.array(z.string().min(1).max(40)).max(20).optional(),
  timeframes: z.array(z.enum(["M1", "M5", "M15", "M30", "H1"])).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.issues },
      { status: 400 }
    )
  }

  const token = generateAccountToken()
  const tokenHash = await hashAccountToken(token)

  const service = createServiceRoleClient()
  const { data: account, error: insertErr } = await service
    .from("accounts")
    .insert({
      user_id: user.id,
      label: parsed.data.label.trim(),
      broker: parsed.data.broker,
      account_type: parsed.data.account_type,
      mt5_path: parsed.data.mt5_path?.trim() || null,
      symbols: parsed.data.symbols ?? [],
      timeframes: parsed.data.timeframes ?? ["M5", "M15"],
      token_hash: tokenHash,
    })
    .select("id, label, broker, account_type, mt5_path, symbols, timeframes, last_seen, active, created_at, user_id")
    .single()

  if (insertErr || !account) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Erro ao criar conta" },
      { status: 500 }
    )
  }

  let pkg
  try {
    pkg = await buildAgentPackage({
      label: account.label as string,
      ingestUrl: `${request.nextUrl.origin}/api/ingest`,
      ingestToken: token,
      mt5Path: parsed.data.mt5_path,
      symbols: (account.symbols as string[]) ?? [],
      timeframes: (account.timeframes as string[]) ?? ["M5", "M15"],
    })
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Erro ao montar pacote do agent",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ account, token, package: pkg })
}
