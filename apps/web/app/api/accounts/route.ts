import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { generateAccountToken, hashAccountToken } from "@/lib/account-token"
import { generateBootstrapScript, type AgentOS } from "@/lib/agent-bootstrap"

const createSchema = z.object({
  label: z.string().min(1).max(80),
  broker: z.enum(["xp", "hantec", "other"]),
  account_type: z.enum(["real", "demo"]).optional().nullable(),
  mt5_path: z.string().max(500).optional().nullable(),
})

function buildScripts(input: { ingestUrl: string; token: string; mt5Path?: string | null }) {
  const out: Record<AgentOS, { filename: string; content: string }> = {} as Record<
    AgentOS,
    { filename: string; content: string }
  >
  for (const os of ["windows", "mac", "linux"] as AgentOS[]) {
    const s = generateBootstrapScript({
      os,
      ingestUrl: input.ingestUrl,
      ingestToken: input.token,
      mt5Path: input.mt5Path ?? null,
    })
    out[os] = { filename: s.filename, content: s.content }
  }
  return out
}

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
      account_type: parsed.data.account_type ?? null,
      mt5_path: parsed.data.mt5_path?.trim() || null,
      token_hash: tokenHash,
    })
    .select("id, label, broker, account_type, mt5_path, last_seen, active, created_at")
    .single()

  if (insertErr || !account) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Erro ao criar conta" },
      { status: 500 }
    )
  }

  const scripts = buildScripts({
    ingestUrl: `${request.nextUrl.origin}/api/ingest`,
    token,
    mt5Path: parsed.data.mt5_path,
  })

  return NextResponse.json({ account, token, scripts })
}
