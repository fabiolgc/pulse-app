import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { evaluateRule } from "@/lib/rule-engine"
import { buildIndicators, detectCandlePatterns } from "@/lib/indicators"
import type { Candle, RuleLogic } from "@/types"

export async function POST(request: NextRequest) {
  let body: { symbol: string; source: string; tf?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { symbol, source, tf = "M5" } = body
  if (!symbol || !source) {
    return NextResponse.json(
      { error: "symbol and source are required" },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  // Fetch last 100 candles for indicator calculation
  const { data: candleRows, error: candlesErr } = await supabase
    .from("candles_history")
    .select("*")
    .eq("symbol", symbol)
    .eq("source", source)
    .eq("tf", tf)
    .order("time", { ascending: true })
    .limit(100)

  if (candlesErr || !candleRows?.length) {
    return NextResponse.json({
      ok: true,
      signals: [],
      reason: "No candle data available",
    })
  }

  const candles: Candle[] = candleRows.map((r: Record<string, unknown>) => ({
    time: Number(r.time),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }))

  const indicators = buildIndicators(candles)
  const patterns = detectCandlePatterns(candles)
  const lastPrice = candles[candles.length - 1].close

  // Build previous indicators (excluding last candle) for crossover detection
  let prevIndicators = undefined
  if (candles.length > 1) {
    prevIndicators = buildIndicators(candles.slice(0, -1))
  }

  // Fetch active rules for this symbol
  const { data: activeRules, error: rulesErr } = await supabase
    .from("rules")
    .select("*")
    .eq("symbol", symbol)
    .eq("active", true)

  if (rulesErr || !activeRules?.length) {
    return NextResponse.json({ ok: true, signals: [] })
  }

  const signals: Array<{
    ruleId: string
    ruleName: string
    triggered: boolean
    direction: string
    message: string
  }> = []

  for (const rule of activeRules) {
    const logic = rule.logic_json as RuleLogic
    const triggered = evaluateRule({
      rule: logic,
      indicators,
      patterns,
      price: lastPrice,
      prevIndicators,
    })

    if (triggered) {
      const message = `Regra "${rule.name}" disparou: ${logic.signal} em ${symbol} @ ${lastPrice}`

      // Save alert
      await supabase.from("alerts").insert({
        user_id: rule.user_id,
        rule_id: rule.id,
        source,
        symbol,
        price: lastPrice,
        message,
        direction: logic.signal,
      })

      signals.push({
        ruleId: rule.id,
        ruleName: rule.name,
        triggered: true,
        direction: logic.signal,
        message,
      })
    }
  }

  return NextResponse.json({ ok: true, signals })
}
