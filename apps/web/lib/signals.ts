import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateRule } from "@/lib/rule-engine"
import { buildIndicators, detectCandlePatterns } from "@/lib/indicators"
import type { Candle, RuleLogic } from "@/types"

export interface RunSignalCheckParams {
  supabase: SupabaseClient
  symbol: string
  source: string
  tf?: string
  /** Quando setado, filtra rules e candles por essa conta (multi-conta). */
  accountId?: string | null
}

export interface SignalCheckResult {
  ok: true
  signals: Array<{
    ruleId: string
    ruleName: string
    direction: string
    message: string
  }>
  reason?: string
}

export async function runSignalCheck({
  supabase,
  symbol,
  source,
  tf = "M5",
  accountId = null,
}: RunSignalCheckParams): Promise<SignalCheckResult> {
  let candleQuery = supabase
    .from("candles_history")
    .select("*")
    .eq("symbol", symbol)
    .eq("source", source)
    .eq("tf", tf)
    .order("time", { ascending: true })
    .limit(100)

  candleQuery = accountId
    ? candleQuery.eq("account_id", accountId)
    : candleQuery.is("account_id", null)

  const { data: candleRows, error: candlesErr } = await candleQuery

  if (candlesErr || !candleRows?.length) {
    return { ok: true, signals: [], reason: "No candle data available" }
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
  const prevIndicators =
    candles.length > 1 ? buildIndicators(candles.slice(0, -1)) : undefined

  let rulesQuery = supabase
    .from("rules")
    .select("*")
    .eq("symbol", symbol)
    .eq("active", true)

  rulesQuery = accountId
    ? rulesQuery.eq("account_id", accountId)
    : rulesQuery.is("account_id", null)

  const { data: activeRules, error: rulesErr } = await rulesQuery

  if (rulesErr || !activeRules?.length) {
    return { ok: true, signals: [] }
  }

  const signals: SignalCheckResult["signals"] = []

  for (const rule of activeRules) {
    const logic = rule.logic_json as RuleLogic
    const triggered = evaluateRule({
      rule: logic,
      indicators,
      patterns,
      price: lastPrice,
      prevIndicators,
    })

    if (!triggered) continue

    const message = `Regra "${rule.name}" disparou: ${logic.signal} em ${symbol} @ ${lastPrice}`
    await supabase.from("alerts").insert({
      user_id: rule.user_id,
      rule_id: rule.id,
      account_id: rule.account_id ?? null,
      source,
      symbol,
      price: lastPrice,
      message,
      direction: logic.signal,
    })
    signals.push({
      ruleId: rule.id,
      ruleName: rule.name,
      direction: logic.signal,
      message,
    })
  }

  return { ok: true, signals }
}
