import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { evaluateRule } from "@/lib/rule-engine"
import { buildIndicators, detectCandlePatterns } from "@/lib/indicators"
import type { Candle, RuleLogic, BacktestMetrics, BacktestTrade } from "@/types"

const MIN_CANDLES_FOR_INDICATORS = 30

export async function POST(request: NextRequest) {
  let body: {
    ruleId: string
    source: string
    startDate: string
    endDate: string
    userId: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { ruleId, source, startDate, endDate, userId } = body
  if (!ruleId || !source || !startDate || !endDate || !userId) {
    return NextResponse.json(
      { error: "ruleId, source, startDate, endDate, userId are required" },
      { status: 400 }
    )
  }

  const supabase = createServiceRoleClient()

  // Fetch rule
  const { data: rule, error: ruleErr } = await supabase
    .from("rules")
    .select("*")
    .eq("id", ruleId)
    .single()

  if (ruleErr || !rule) {
    return NextResponse.json({ error: "Rule not found" }, { status: 404 })
  }

  const logic = rule.logic_json as RuleLogic
  const startTs = new Date(startDate).getTime()
  const endTs = new Date(endDate).getTime()

  // Fetch candles in date range
  const { data: candleRows, error: candlesErr } = await supabase
    .from("candles_history")
    .select("*")
    .eq("symbol", rule.symbol)
    .eq("source", source)
    .eq("tf", rule.tf)
    .gte("time", startTs)
    .lte("time", endTs)
    .order("time", { ascending: true })

  if (candlesErr || !candleRows?.length) {
    return NextResponse.json(
      { error: "No candle data for the specified period" },
      { status: 404 }
    )
  }

  const candles: Candle[] = candleRows.map((r: Record<string, unknown>) => ({
    time: Number(r.time),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }))

  // Run backtest candle by candle
  const trades: BacktestTrade[] = []
  let inPosition = false
  let entryPrice = 0
  let entryTime = 0
  let direction = logic.signal

  for (let i = MIN_CANDLES_FOR_INDICATORS; i < candles.length; i++) {
    const window = candles.slice(0, i + 1)
    const indicators = buildIndicators(window)
    const patterns = detectCandlePatterns(window)
    const price = candles[i].close

    if (inPosition) {
      // Check stop/gain
      const pointDiff =
        direction === "compra" ? price - entryPrice : entryPrice - price
      const isStop = pointDiff <= -logic.risk.stop_points
      const isGain = pointDiff >= logic.risk.gain_points

      if (isStop || isGain) {
        trades.push({
          entryTime,
          entryPrice,
          exitTime: candles[i].time,
          exitPrice: price,
          direction,
          result: pointDiff,
          resultPercent: (pointDiff / entryPrice) * 100,
        })
        inPosition = false
      }
      continue
    }

    // Check entry
    const prevIndicators =
      i > MIN_CANDLES_FOR_INDICATORS
        ? buildIndicators(candles.slice(0, i))
        : undefined

    const triggered = evaluateRule({
      rule: logic,
      indicators,
      patterns,
      price,
      prevIndicators,
    })

    if (triggered) {
      inPosition = true
      entryPrice = price
      entryTime = candles[i].time
      direction = logic.signal
    }
  }

  // Close any open position at the end
  if (inPosition) {
    const lastCandle = candles[candles.length - 1]
    const pointDiff =
      direction === "compra"
        ? lastCandle.close - entryPrice
        : entryPrice - lastCandle.close
    trades.push({
      entryTime,
      entryPrice,
      exitTime: lastCandle.time,
      exitPrice: lastCandle.close,
      direction,
      result: pointDiff,
      resultPercent: (pointDiff / entryPrice) * 100,
    })
  }

  // Calculate metrics
  const wins = trades.filter((t) => t.result > 0)
  const losses = trades.filter((t) => t.result <= 0)
  const totalGain = wins.reduce((s, t) => s + t.result, 0)
  const totalLoss = Math.abs(losses.reduce((s, t) => s + t.result, 0))

  let maxDrawdown = 0
  let peak = 0
  let cumulative = 0
  for (const trade of trades) {
    cumulative += trade.result
    if (cumulative > peak) peak = cumulative
    const dd = peak - cumulative
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  const metrics: BacktestMetrics = {
    totalTrades: trades.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    profitFactor: totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0,
    maxDrawdown,
    netResult: cumulative,
    trades,
  }

  // Save results
  await supabase.from("backtest_results").insert({
    user_id: userId,
    rule_id: ruleId,
    source,
    symbol: rule.symbol,
    tf: rule.tf,
    start_date: startDate,
    end_date: endDate,
    metrics_json: metrics,
  })

  return NextResponse.json({ ok: true, metrics })
}
