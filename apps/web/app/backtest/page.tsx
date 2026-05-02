"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { BarChart3, Loader2, Play, Plus, Sparkles } from "lucide-react"
import type { CandlestickData, Time } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { RuleChart, type ChartMarker } from "@/components/rule-chart"
import { BacktestPlayer } from "@/components/backtest-player"
import { EmptyState } from "@/components/empty-state"
import { InfoTooltip } from "@/components/info-tooltip"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/lib/toast"
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
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background">
          <AppHeader />
          <main className="p-6 max-w-5xl mx-auto">
            <Loader2 className="h-5 w-5 animate-spin" />
          </main>
        </div>
      }
    >
      <BacktestPageInner />
    </Suspense>
  )
}

function BacktestPageInner() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
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
  const [chartTab, setChartTab] = useState<"static" | "replay">("static")

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
      const m = data.metrics as BacktestMetrics
      setMetrics(m)
      toast.success(
        m.totalTrades === 0
          ? "Backtest concluído · nenhum trade no período"
          : `Backtest concluído · ${m.totalTrades} ${m.totalTrades === 1 ? "trade" : "trades"}`
      )

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
      const msg = err instanceof Error ? err.message : "Erro desconhecido"
      setError(msg)
      toast.error(`Não consegui rodar o backtest: ${msg}`)
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

      <main className="px-6 py-6 max-w-7xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Backtest</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Avalie uma regra contra histórico antes de ativar.
          </p>
        </header>

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle className="text-sm">Configurar execução</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingRules ? (
              <div className="py-6 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </div>
            ) : rules.length === 0 ? (
              <EmptyState
                className="py-8"
                icon={<Sparkles className="h-5 w-5" />}
                title="Crie uma regra antes de rodar backtest"
                description={
                  <>
                    O backtest avalia uma regra contra histórico. Crie a sua
                    primeira regra em linguagem natural — leva menos de 1
                    minuto.
                  </>
                }
                primaryAction={{
                  label: "Nova regra",
                  href: "/rules/new",
                  icon: <Plus className="h-4 w-4" />,
                }}
              />
            ) : (
              <>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
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
            <section className="mt-12 pb-8 border-b border-border">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-8 md:items-end">
                <div className="md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                    Resultado líquido
                    <InfoTooltip
                      ariaLabel="O que é resultado líquido"
                      hint="Soma de todos os ganhos e perdas em pontos no período. Não inclui custos de corretagem, emolumentos ou slippage."
                    />
                  </p>
                  <p
                    className={`font-mono font-medium tabular-nums tracking-tight mt-2 text-5xl md:text-6xl leading-none ${
                      metrics.netResult > 0
                        ? "text-emerald-500"
                        : metrics.netResult < 0
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {metrics.netResult > 0 ? "+" : ""}
                    {formatPoints(metrics.netResult)}
                    <span className="text-2xl text-muted-foreground ml-2 font-normal">pts</span>
                  </p>
                </div>
                <WinRateBar winRate={metrics.winRate} total={metrics.totalTrades} />
              </div>
              <div className="flex flex-wrap gap-x-12 gap-y-4 mt-10">
                <SubStat
                  label="Trades"
                  value={String(metrics.totalTrades)}
                  hint="Número total de operações simuladas no período."
                />
                <SubStat
                  label="Profit Factor"
                  value={formatProfitFactor(metrics.profitFactor)}
                  hint="Soma dos ganhos dividida pela soma das perdas. Acima de 1.0 indica lucro líquido. 1.5+ é considerado bom; 2.0+ é excelente."
                />
                <SubStat
                  label="Max Drawdown"
                  value={formatPoints(metrics.maxDrawdown)}
                  tone="negative"
                  hint="Maior queda contínua do saldo durante o backtest, em pontos. Quanto menor, mais consistente a regra — picos altos exigem capital extra para suportar a sequência de perdas."
                />
              </div>
            </section>

            {metrics.trades.length > 0 && (
              <Card id="backtest-chart" className="mt-8">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">
                    Gráfico {selectedRule?.symbol} — {selectedRule?.tf}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={chartTab === "static" ? "default" : "outline"}
                      onClick={() => setChartTab("static")}
                    >
                      Estático
                    </Button>
                    <Button
                      size="sm"
                      variant={chartTab === "replay" ? "default" : "outline"}
                      onClick={() => setChartTab("replay")}
                    >
                      Replay visual
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartTab === "static" ? (
                    <>
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
                    </>
                  ) : (
                    <BacktestPlayer
                      candles={chartCandles}
                      trades={metrics.trades}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            <section className="mt-10">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-sm font-medium tracking-tight">
                  Trades{" "}
                  <span className="text-muted-foreground font-normal font-mono tabular-nums">
                    ({metrics.trades.length})
                  </span>
                </h3>
                {metrics.trades.length > 0 && (
                  <p className="text-[11px] text-muted-foreground hidden sm:block">
                    Clique em uma linha para focar o trade no gráfico
                  </p>
                )}
              </div>
              {metrics.trades.length === 0 ? (
                <div className="py-10 px-6 text-center border border-dashed border-border rounded-lg">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium">Nenhum trade no período</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                    A regra não disparou nenhum sinal entre as datas escolhidas.
                    Tente um intervalo maior, troque a fonte de dados, ou
                    confirme se há candles importados para esse símbolo e
                    timeframe.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full min-w-[720px] text-xs">
                    <thead className="text-left text-muted-foreground sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                      <tr className="border-b border-border">
                        <th className="py-2 pr-3 font-normal text-[11px] uppercase tracking-wider">Entrada</th>
                        <th className="py-2 pr-3 font-normal text-[11px] uppercase tracking-wider">Saída</th>
                        <th className="py-2 pr-3 font-normal text-[11px] uppercase tracking-wider">Direção</th>
                        <th className="py-2 pr-3 text-right font-normal text-[11px] uppercase tracking-wider">Preço entrada</th>
                        <th className="py-2 pr-3 text-right font-normal text-[11px] uppercase tracking-wider">Preço saída</th>
                        <th className="py-2 pr-3 text-right font-normal text-[11px] uppercase tracking-wider">Resultado (pts)</th>
                        <th className="py-2 text-right font-normal text-[11px] uppercase tracking-wider">%</th>
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
                            <td className="py-2 pr-3 whitespace-nowrap font-mono tabular-nums text-[11px]">
                              {formatDateTime(t.entryTime)}
                            </td>
                            <td className="py-2 pr-3 whitespace-nowrap font-mono tabular-nums text-[11px]">
                              {formatDateTime(t.exitTime)}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className="capitalize">
                                {t.direction}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono tabular-nums">
                              {formatPoints(t.entryPrice)}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono tabular-nums">
                              {formatPoints(t.exitPrice)}
                            </td>
                            <td
                              className={`py-2 pr-3 text-right font-mono tabular-nums font-medium ${
                                t.result >= 0 ? "text-emerald-500" : "text-destructive"
                              }`}
                            >
                              {formatPoints(t.result)}
                            </td>
                            <td
                              className={`py-2 text-right font-mono tabular-nums ${
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
              </section>
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

function SubStat({
  label,
  value,
  tone,
  hint,
}: {
  label: string
  value: string
  tone?: "positive" | "negative"
  hint?: string
}) {
  const color =
    tone === "positive"
      ? "text-emerald-500"
      : tone === "negative"
      ? "text-destructive"
      : "text-foreground"
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
        {label}
        {hint && <InfoTooltip ariaLabel={`O que é ${label}`} hint={hint} />}
      </p>
      <p className={`text-lg font-mono font-medium tabular-nums tracking-tight mt-1 ${color}`}>
        {value}
      </p>
    </div>
  )
}

function WinRateBar({
  winRate,
  total,
}: {
  winRate: number
  total: number
}) {
  const pct = Math.max(0, Math.min(100, winRate))
  const wins = Math.round((pct / 100) * total)
  const losses = total - wins
  return (
    <div className="space-y-2 min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
          Win rate
          <InfoTooltip
            ariaLabel="O que é win rate"
            hint="Percentual de operações que terminaram em ganho. Win rate alto não garante lucro — uma regra com 70% de acertos e perdas grandes pode ser pior que 40% com perdas pequenas. Avalie junto com Profit Factor."
          />
        </span>
        <span className="font-mono text-2xl font-medium tabular-nums tracking-tight">
          {pct.toFixed(1)}
          <span className="text-base text-muted-foreground font-normal">%</span>
        </span>
      </div>
      <div
        className="flex h-1.5 rounded-full overflow-hidden bg-destructive/30"
        role="img"
        aria-label={`${wins} ganhos de ${total} trades`}
      >
        <div
          className="bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] font-mono tabular-nums text-muted-foreground">
        <span>{wins} ganhos</span>
        <span>{losses} perdas</span>
      </div>
    </div>
  )
}
