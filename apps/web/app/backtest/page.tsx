"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BarChart3, Loader2, Play } from "lucide-react"
import type { CandlestickData, Time } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { RuleChart, type ChartMarker } from "@/components/rule-chart"
import { createClient } from "@/lib/supabase"
import type { BacktestMetrics, BacktestTrade, SourceId } from "@/types"

type RuleOption = {
  id: string
  name: string
  symbol: string
  tf: string
}

const SOURCES: { value: SourceId; label: string }[] = [
  { value: "mt5", label: "MT5" },
  { value: "synthetic", label: "Synthetic" },
  { value: "cedro", label: "Cedro" },
  { value: "nelogica", label: "Nelogica" },
]

function todayIso(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function formatPoints(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`
}

function formatProfitFactor(value: number): string {
  if (!isFinite(value)) return "∞"
  return value.toFixed(2)
}

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function tradesToMarkers(trades: BacktestTrade[]): ChartMarker[] {
  const markers: ChartMarker[] = []
  for (const t of trades) {
    const isBuy = t.direction === "compra"
    markers.push({
      time: t.entryTime,
      position: isBuy ? "belowBar" : "aboveBar",
      color: "#3b82f6",
      shape: isBuy ? "arrowUp" : "arrowDown",
      text: isBuy ? "C" : "V",
    })
    const win = t.result >= 0
    markers.push({
      time: t.exitTime,
      position: isBuy ? "aboveBar" : "belowBar",
      color: win ? "#10b981" : "#ef4444",
      shape: isBuy ? "arrowDown" : "arrowUp",
      text: `${win ? "+" : ""}${Math.round(t.result)}`,
    })
  }
  return markers
}

export default function BacktestPage() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const presetRuleId = searchParams.get("ruleId")
  const [rules, setRules] = useState<RuleOption[]>([])
  const [loadingRules, setLoadingRules] = useState(true)
  const [ruleId, setRuleId] = useState("")
  const [source, setSource] = useState<SourceId>("mt5")
  const [startDate, setStartDate] = useState(todayIso(-30))
  const [endDate, setEndDate] = useState(todayIso(0))
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<BacktestMetrics | null>(null)
  const [chartCandles, setChartCandles] = useState<CandlestickData[] | null>(null)
  const [focusRange, setFocusRange] = useState<[number, number] | null>(null)

  useEffect(() => {
    let mounted = true
    supabase
      .from("rules")
      .select("id, name, symbol, tf")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          setError(error.message)
        } else {
          const list = (data ?? []) as RuleOption[]
          setRules(list)
          const initial =
            (presetRuleId && list.find((r) => r.id === presetRuleId)?.id) ||
            list[0]?.id ||
            ""
          setRuleId(initial)
        }
        setLoadingRules(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase, presetRuleId])

  const selectedRule = rules.find((r) => r.id === ruleId)

  async function runBacktest() {
    if (!ruleId) return
    setRunning(true)
    setError(null)
    setMetrics(null)
    setChartCandles(null)
    setFocusRange(null)
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error("Sessão expirada. Faça login novamente.")

      const res = await fetch("/api/run-backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleId,
          source,
          startDate,
          endDate,
          userId: user.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao rodar backtest")
      setMetrics(data.metrics as BacktestMetrics)

      if (selectedRule) {
        const startMs = new Date(startDate).getTime()
        const endMs = new Date(endDate).getTime() + 24 * 3600 * 1000
        const { data: candleData } = await supabase
          .from("candles_history")
          .select("time, open, high, low, close")
          .eq("symbol", selectedRule.symbol)
          .eq("source", source)
          .eq("tf", selectedRule.tf)
          .gte("time", startMs)
          .lte("time", endMs)
          .order("time", { ascending: true })
          .limit(20000)
        if (candleData?.length) {
          const candles: CandlestickData[] = candleData
            .map((c) => ({
              time: Math.floor(Number(c.time) / 1000) as Time,
              open: Number(c.open),
              high: Number(c.high),
              low: Number(c.low),
              close: Number(c.close),
            }))
            .reduce<CandlestickData[]>((acc, cur) => {
              const last = acc[acc.length - 1]
              if (last && last.time === cur.time) acc[acc.length - 1] = cur
              else acc.push(cur)
              return acc
            }, [])
          setChartCandles(candles)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setRunning(false)
    }
  }

  function zoomToTrade(t: BacktestTrade) {
    const margin = 15 * 60 * 1000 // 15 min
    setFocusRange([t.entryTime - margin, t.exitTime + margin])
    document
      .getElementById("backtest-chart")
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const markers = useMemo(
    () => (metrics ? tradesToMarkers(metrics.trades) : []),
    [metrics]
  )

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <h2 className="text-lg font-semibold">Backtest</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Configurar execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingRules ? (
              <div className="py-6 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma regra criada. Crie uma regra antes de rodar backtest.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Regra</label>
                    <Select value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
                      {rules.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.symbol} · {r.tf})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Fonte de dados</label>
                    <Select
                      value={source}
                      onChange={(e) => setSource(e.target.value as SourceId)}
                    >
                      {SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Data início</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={endDate}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Data fim</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      max={todayIso(0)}
                    />
                  </div>
                </div>

                {selectedRule && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{selectedRule.symbol}</Badge>
                    <Badge variant="outline">{selectedRule.tf}</Badge>
                    <span>símbolo e timeframe vêm da regra selecionada</span>
                  </div>
                )}

                <Button onClick={runBacktest} disabled={running || !ruleId}>
                  {running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {running ? "Rodando..." : "Rodar backtest"}
                </Button>

                {error && <p className="text-sm text-destructive">{error}</p>}
              </>
            )}
          </CardContent>
        </Card>

        {metrics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MetricCard label="Trades" value={String(metrics.totalTrades)} />
              <MetricCard label="Win Rate" value={formatPercent(metrics.winRate)} />
              <MetricCard
                label="Profit Factor"
                value={formatProfitFactor(metrics.profitFactor)}
              />
              <MetricCard
                label="Max Drawdown"
                value={formatPoints(metrics.maxDrawdown)}
                tone="negative"
              />
              <MetricCard
                label="Resultado (pts)"
                value={formatPoints(metrics.netResult)}
                tone={metrics.netResult >= 0 ? "positive" : "negative"}
              />
            </div>

            {metrics.trades.length > 0 && (
              <Card id="backtest-chart">
                <CardHeader>
                  <CardTitle className="text-sm">
                    Gráfico {selectedRule?.symbol} — {selectedRule?.tf}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RuleChart
                    candles={chartCandles}
                    markers={markers}
                    focusRange={focusRange}
                  />
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <LegendDot color="#3b82f6" label="Entrada" />
                    <LegendDot color="#10b981" label="Saída ganho" />
                    <LegendDot color="#ef4444" label="Saída perda" />
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Trades</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics.trades.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      Nenhum trade gerado no período. Tente um intervalo maior ou
                      verifique se há candles importados para essa fonte.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3">Entrada</th>
                          <th className="py-2 pr-3">Saída</th>
                          <th className="py-2 pr-3">Direção</th>
                          <th className="py-2 pr-3 text-right">Preço entrada</th>
                          <th className="py-2 pr-3 text-right">Preço saída</th>
                          <th className="py-2 pr-3 text-right">Resultado (pts)</th>
                          <th className="py-2 text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.trades.map((t, i) => (
                          <tr
                            key={i}
                            onClick={() => zoomToTrade(t)}
                            className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                            title="Clique para focar este trade no gráfico"
                          >
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatDateTime(t.entryTime)}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatDateTime(t.exitTime)}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className="capitalize">
                                {t.direction}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {formatPoints(t.entryPrice)}
                            </td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {formatPoints(t.exitPrice)}
                            </td>
                            <td
                              className={`py-2 pr-3 text-right tabular-nums ${
                                t.result >= 0 ? "text-emerald-500" : "text-destructive"
                              }`}
                            >
                              {formatPoints(t.result)}
                            </td>
                            <td
                              className={`py-2 text-right tabular-nums ${
                                t.resultPercent >= 0 ? "text-emerald-500" : "text-destructive"
                              }`}
                            >
                              {formatPercent(t.resultPercent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "positive" | "negative"
}) {
  const color =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "negative"
      ? "text-destructive"
      : "text-foreground"
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold tabular-nums mt-1 ${color}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
