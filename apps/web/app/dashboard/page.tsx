"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts"
import { Bell, TrendingUp, TrendingDown, Activity, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"

type CandleRow = {
  source: string
  symbol: string
  tf: string
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type AlertRow = {
  id: string
  symbol: string
  source: string
  price: number
  message: string
  direction: string | null
  triggered_at: string
}

const MAIN_SYMBOL = "WINFUT"
const SECOND_SYMBOL = "WDOFUT"
const TF = "M5"

function formatPrice(value: number | null) {
  if (value == null) return "—"
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function startOfTodayMs() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)

  const [winLast, setWinLast] = useState<CandleRow | null>(null)
  const [wdoLast, setWdoLast] = useState<CandleRow | null>(null)
  const [activeRulesCount, setActiveRulesCount] = useState<number>(0)
  const [alertsToday, setAlertsToday] = useState<number>(0)
  const [recentAlerts, setRecentAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)

  // Initial load
  useEffect(() => {
    let mounted = true
    async function load() {
      const todayMs = startOfTodayMs()
      const todayIso = new Date(todayMs).toISOString()

      const [winRes, wdoRes, rulesRes, alertsRes, recentRes] = await Promise.all([
        supabase
          .from("candles_history")
          .select("*")
          .eq("symbol", MAIN_SYMBOL)
          .eq("tf", TF)
          .order("time", { ascending: false })
          .limit(1),
        supabase
          .from("candles_history")
          .select("*")
          .eq("symbol", SECOND_SYMBOL)
          .eq("tf", TF)
          .order("time", { ascending: false })
          .limit(1),
        supabase.from("rules").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("alerts")
          .select("id", { count: "exact", head: true })
          .gte("triggered_at", todayIso),
        supabase
          .from("alerts")
          .select("id, symbol, source, price, message, direction, triggered_at")
          .order("triggered_at", { ascending: false })
          .limit(10),
      ])

      if (!mounted) return
      if (winRes.data?.[0]) setWinLast(winRes.data[0] as CandleRow)
      if (wdoRes.data?.[0]) setWdoLast(wdoRes.data[0] as CandleRow)
      setActiveRulesCount(rulesRes.count ?? 0)
      setAlertsToday(alertsRes.count ?? 0)
      setRecentAlerts((recentRes.data ?? []) as AlertRow[])
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  // Realtime subscription: candles + alerts
  useEffect(() => {
    const channel = supabase
      .channel("dashboard")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candles_history", filter: `tf=eq.${TF}` },
        (payload) => {
          const row = payload.new as CandleRow
          if (row.symbol === MAIN_SYMBOL) {
            setWinLast((prev) => (!prev || row.time > prev.time ? row : prev))
            // Update chart
            if (seriesRef.current) {
              seriesRef.current.update({
                time: Math.floor(row.time / 1000) as Time,
                open: Number(row.open),
                high: Number(row.high),
                low: Number(row.low),
                close: Number(row.close),
              })
            }
          } else if (row.symbol === SECOND_SYMBOL) {
            setWdoLast((prev) => (!prev || row.time > prev.time ? row : prev))
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const row = payload.new as AlertRow
          setRecentAlerts((prev) => [row, ...prev].slice(0, 10))
          setAlertsToday((c) => c + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Chart setup + initial candle load
  useEffect(() => {
    if (!chartContainerRef.current) return
    const container = chartContainerRef.current
    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: "#9ca3af",
      },
      grid: {
        vertLines: { color: "rgba(63, 63, 70, 0.4)" },
        horzLines: { color: "rgba(63, 63, 70, 0.4)" },
      },
      timeScale: { borderColor: "#3f3f46", timeVisible: true },
      rightPriceScale: { borderColor: "#3f3f46" },
    })
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    })
    chartRef.current = chart
    seriesRef.current = series

    // Load history for the chart
    supabase
      .from("candles_history")
      .select("time, open, high, low, close")
      .eq("symbol", MAIN_SYMBOL)
      .eq("tf", TF)
      .order("time", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (!data?.length) return
        const candles: CandlestickData[] = data
          .map((c) => ({
            time: Math.floor(Number(c.time) / 1000) as Time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }))
          // Dedup same-second timestamps (keep last)
          .reduce<CandlestickData[]>((acc, cur) => {
            const last = acc[acc.length - 1]
            if (last && last.time === cur.time) acc[acc.length - 1] = cur
            else acc.push(cur)
            return acc
          }, [])
        series.setData(candles)
        chart.timeScale().fitContent()
      })

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [supabase])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PriceCard symbol={MAIN_SYMBOL} candle={winLast} loading={loading} />
          <PriceCard symbol={SECOND_SYMBOL} candle={wdoLast} loading={loading} />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Regras Ativas
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : activeRulesCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeRulesCount > 0 ? "Monitorando" : "Nenhuma regra ativa"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas Hoje
              </CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : alertsToday}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {alertsToday > 0 ? "Sinais disparados" : "Nenhum alerta disparado"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Gráfico {MAIN_SYMBOL} — {TF}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={chartContainerRef}
              className="h-[400px] w-full"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Alertas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum alerta ainda. Crie e ative regras para começar a receber sinais.
              </p>
            ) : (
              <ul className="space-y-2">
                {recentAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-4 text-sm border-b border-border last:border-0 pb-2 last:pb-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {a.direction === "compra" ? (
                        <TrendingUp className="h-4 w-4 text-bull shrink-0" />
                      ) : a.direction === "venda" ? (
                        <TrendingDown className="h-4 w-4 text-bear shrink-0" />
                      ) : (
                        <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.symbol} @ {formatPrice(Number(a.price))} · {a.source}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {formatTime(a.triggered_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function PriceCard({
  symbol,
  candle,
  loading,
}: {
  symbol: string
  candle: CandleRow | null
  loading: boolean
}) {
  const isUp = candle ? Number(candle.close) >= Number(candle.open) : true
  const Icon = isUp ? TrendingUp : TrendingDown
  const iconColor = isUp ? "text-bull" : "text-bear"

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{symbol}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : candle ? (
            formatPrice(Number(candle.close))
          ) : (
            "—"
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {candle ? (
            <>
              {candle.source} · {new Date(candle.time).toLocaleTimeString("pt-BR")}
            </>
          ) : (
            "Aguardando conexão do agente..."
          )}
        </p>
      </CardContent>
    </Card>
  )
}
