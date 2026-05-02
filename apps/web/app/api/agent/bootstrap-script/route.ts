import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { generateBootstrapScript, type AgentOS } from "@/lib/agent-bootstrap"

function parseIngestToken(): string | null {
  try {
    const tokens = JSON.parse(process.env.INGEST_TOKENS ?? "{}")
    const v = tokens.mt5
    return typeof v === "string" && v.length > 0 ? v : null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  // Auth: precisa de sessão pra baixar o script (token vai dentro)
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const osParam = request.nextUrl.searchParams.get("os") as AgentOS | null
  if (!osParam || !["windows", "mac", "linux"].includes(osParam)) {
    return NextResponse.json(
      { error: "os deve ser 'windows', 'mac' ou 'linux'" },
      { status: 400 }
    )
  }

  const ingestToken = parseIngestToken()
  if (!ingestToken) {
    return NextResponse.json(
      {
        error:
          "Token de ingest não configurado no servidor (INGEST_TOKENS sem chave 'mt5').",
      },
      { status: 500 }
    )
  }

  const ingestUrl = `${request.nextUrl.origin}/api/ingest`

  const script = generateBootstrapScript({
    os: osParam,
    ingestUrl,
    ingestToken,
  })

  return new NextResponse(script.content, {
    headers: {
      "Content-Type": `${script.mimeType}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${script.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
