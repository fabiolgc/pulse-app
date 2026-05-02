import { NextRequest, NextResponse } from "next/server"
import { validateIngestMessage } from "@/lib/ingest-schema"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { hashAccountToken } from "@/lib/account-token"
import { runSignalCheck } from "@/lib/signals"

interface ResolvedAuth {
  sourceId: string
  accountId: string
  accountActive: boolean
}

/**
 * Resolve Bearer token via accounts.token_hash. Cada agent é amarrado a uma conta;
 * conta inativa ainda recebe candles (histórico) mas não dispara regras.
 */
async function authenticate(
  authHeader: string | null,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<ResolvedAuth | null> {
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)

  const tokenHash = await hashAccountToken(token)
  const { data: account } = await supabase
    .from("accounts")
    .select("id, active")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  if (!account) return null

  return {
    sourceId: "mt5",
    accountId: account.id as string,
    accountActive: account.active === true,
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServiceRoleClient()
  const auth = await authenticate(request.headers.get("authorization"), supabase)
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Historical imports must skip the rule engine — otherwise a backfill of
  // 2024 candles would create alerts on the live dashboard.
  const isHistorical = request.nextUrl.searchParams.get("historical") === "1"

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const messages = Array.isArray(body) ? body : [body]
  const errors: string[] = []
  let inserted = 0
  // (symbol, source, tf, accountId|null) → roda rule engine uma vez por combo
  const candleKeys = new Set<string>()

  for (const raw of messages) {
    try {
      const envelope = validateIngestMessage(raw)

      if (envelope.source !== auth.sourceId) {
        errors.push(`Source mismatch: token=${auth.sourceId}, msg=${envelope.source}`)
        continue
      }

      if (envelope.type === "candle" && envelope.tf) {
        const data = envelope.data as {
          open: number
          high: number
          low: number
          close: number
          volume: number
        }
        const { error } = await supabase.from("candles_history").upsert(
          {
            source: envelope.source,
            account_id: auth.accountId,
            symbol: envelope.symbol,
            tf: envelope.tf,
            time: envelope.ts,
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
            volume: data.volume,
          },
          { onConflict: "source,symbol,tf,time" }
        )
        if (error) {
          errors.push(`DB error: ${error.message}`)
        } else {
          inserted++
          candleKeys.add(
            `${envelope.symbol}|${envelope.source}|${envelope.tf}|${auth.accountId}`
          )
        }
      }

      if (envelope.type === "heartbeat") {
        await supabase
          .from("accounts")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", auth.accountId)
      }

      if (envelope.type === "tick") {
        await supabase
          .channel(`ticks:${envelope.source}:${envelope.symbol}`)
          .send({
            type: "broadcast",
            event: "tick",
            payload: envelope.data,
          })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      errors.push(message)
    }
  }

  await supabase
    .from("accounts")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", auth.accountId)

  let triggered = 0
  // Conta inativa: candles ainda são salvos (histórico), mas o motor de regras
  // não roda — o usuário escolheu Real OU Demo, e a outra fica em standby.
  if (!isHistorical && auth.accountActive) {
    for (const key of candleKeys) {
      const [symbol, source, tf, accountId] = key.split("|")
      try {
        const res = await runSignalCheck({
          supabase,
          symbol,
          source,
          tf,
          accountId,
        })
        triggered += res.signals.length
      } catch (err) {
        const message = err instanceof Error ? err.message : "signal check failed"
        errors.push(`signals(${key}): ${message}`)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    inserted,
    triggered,
    errors: errors.length > 0 ? errors : undefined,
  })
}
