import { NextRequest, NextResponse } from "next/server"
import { validateIngestMessage } from "@/lib/ingest-schema"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { runSignalCheck } from "@/lib/signals"

type IngestTokenMap = Record<string, string>

function parseIngestTokens(): IngestTokenMap {
  try {
    return JSON.parse(process.env.INGEST_TOKENS ?? "{}")
  } catch {
    return {}
  }
}

function authenticateSource(
  authHeader: string | null,
  tokens: IngestTokenMap
): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null
  const token = authHeader.slice(7)
  const entry = Object.entries(tokens).find(([, t]) => t === token)
  return entry ? entry[0] : null
}

export async function POST(request: NextRequest) {
  const tokens = parseIngestTokens()
  const sourceId = authenticateSource(
    request.headers.get("authorization"),
    tokens
  )
  if (!sourceId) {
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

  // Accept single message or batch
  const messages = Array.isArray(body) ? body : [body]
  const supabase = createServiceRoleClient()
  const errors: string[] = []
  let inserted = 0
  // Track which (symbol, source, tf) combos got new candles, so we run the
  // rule engine once per combo at the end (not per message).
  const candleKeys = new Set<string>()

  for (const raw of messages) {
    try {
      const envelope = validateIngestMessage(raw)

      if (envelope.source !== sourceId) {
        errors.push(`Source mismatch: token=${sourceId}, msg=${envelope.source}`)
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
          candleKeys.add(`${envelope.symbol}|${envelope.source}|${envelope.tf}`)
        }
      }

      if (envelope.type === "heartbeat") {
        await supabase
          .from("data_sources")
          .update({ last_seen: new Date().toISOString() })
          .eq("id", envelope.source)
      }

      // Ticks: broadcast via Supabase Realtime (channel-based)
      if (envelope.type === "tick") {
        await supabase.channel(`ticks:${envelope.source}:${envelope.symbol}`)
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

  // Update last_seen for the source
  await supabase
    .from("data_sources")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", sourceId)

  // Run rule engine for every (symbol, source, tf) that just got a new candle.
  // Errors here don't fail the ingest — candles are already persisted.
  let triggered = 0
  if (!isHistorical) {
    for (const key of candleKeys) {
      const [symbol, source, tf] = key.split("|")
      try {
        const res = await runSignalCheck({ supabase, symbol, source, tf })
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
