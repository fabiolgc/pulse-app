import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase-server"
import { generateAccountToken, hashAccountToken } from "@/lib/account-token"
import { buildAgentPackage } from "@/lib/agent-package"

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
    .select("id, user_id, label, mt5_path, symbols, timeframes")
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

  let pkg
  try {
    pkg = await buildAgentPackage({
      label: existing.label as string,
      ingestUrl: `${request.nextUrl.origin}/api/ingest`,
      ingestToken: token,
      mt5Path: (existing.mt5_path as string | null) ?? null,
      symbols: (existing.symbols as string[] | null) ?? [],
      timeframes: (existing.timeframes as string[] | null) ?? ["M5", "M15"],
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

  return NextResponse.json({ token, package: pkg })
}
