import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { generateAccountToken, hashAccountToken } from "@/lib/account-token"
import { generateBootstrapScript, type AgentOS } from "@/lib/agent-bootstrap"

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params

  const service = createServiceRoleClient()
  const { data: existing } = await service
    .from("accounts")
    .select("id, user_id, mt5_path")
    .eq("id", id)
    .maybeSingle()

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 })
  }

  const token = generateAccountToken()
  const tokenHash = await hashAccountToken(token)

  const { error: updateErr } = await service
    .from("accounts")
    .update({ token_hash: tokenHash })
    .eq("id", id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const scripts: Record<AgentOS, { filename: string; content: string }> = {} as Record<
    AgentOS,
    { filename: string; content: string }
  >
  for (const os of ["windows", "mac", "linux"] as AgentOS[]) {
    const s = generateBootstrapScript({
      os,
      ingestUrl: `${request.nextUrl.origin}/api/ingest`,
      ingestToken: token,
      mt5Path: (existing.mt5_path as string | null) ?? null,
    })
    scripts[os] = { filename: s.filename, content: s.content }
  }

  return NextResponse.json({ token, scripts })
}
