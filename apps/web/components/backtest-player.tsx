"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts"
import { Loader2, Pause, Play, SkipForward, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { BacktestTrade } from "@/types"

type Speed = 1 | 4 | 16 | "max"

interface BacktestPlayerProps {
  candles: CandlestickData[] | null
  trades: BacktestTrade[]
  height?: number
}

/**
 * Player de backtest candle-by-candle.
 *
 * Reproduz visualmente os candles em ordem cronológica, marcando entradas/saídas
 * dos trades quando o playhead os alcança. Velocidade controlável (1x = 1 candle/s,
 * 4x, 16x, max = sem delay). Scrub via barra. "Pular para próximo trade" navega
 * o playhead para o próximo entry/exit.
 *
 * O chart é construído uma vez e atualizado via update()/setMarkers, evitando
 * recriação a cada candle.
 */
export function BacktestPlayer({ candles, trades, height = 420 }: BacktestPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  const [playheadIndex, setPlayheadIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>(4)
  const [hovered, setHovered] = useState<CandlestickData | null>(null)

  const total = candles?.length ?? 0
  const currentTimeSec = useMemo(() => {
    if (!candles || playheadIndex < 1) return null
    const c = candles[playheadIndex - 1]
    return c ? (c.time as number) : null
  }, [candles, playheadIndex])

  // Markers visíveis = só os trades cuja entrada já passou pelo playhead
  const visibleMarkers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!currentTimeSec) return []
    const out: SeriesMarker<Time>[] = []
    for (const t of trades) {
      const entrySec = Math.floor(t.entryTime / 1000)
      const exitSec = Math.floor(t.exitTime / 1000)
      const isBuy = t.direction === "compra"
      if (entrySec <= currentTimeSec) {
        out.push({
          time: entrySec as Time,
          position: isBuy ? "belowBar" : "aboveBar",
          color: "#3b82f6",
          shape: isBuy ? "arrowUp" : "arrowDown",
          text: isBuy ? "C" : "V",
        })
      }
      if (exitSec <= currentTimeSec) {
        const win = t.result >= 0
        out.push({
          time: exitSec as Time,
          position: isBuy ? "aboveBar" : "belowBar",
          color: win ? "#10b981" : "#ef4444",
          shape: isBuy ? "arrowDown" : "arrowUp",
          text: `${win ? "+" : ""}${Math.round(t.result)}`,
        })
      }
    }
    return out.sort((a, b) => (a.time as number) - (b.time as number))
  }, [trades, currentTimeSec])

  // Cria chart uma vez por dataset
  useEffect(() => {
    if (!candles || !containerRef.current) return
    const container = containerRef.current
    const chart = createChart(container, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#9ca3af" },
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
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHovered(null)
        return
      }
      const data = param.seriesData.get(series) as CandlestickData | undefined
      setHovered(data ?? null)
    })

    chartRef.current = chart
    seriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])

    setPlayheadIndex(0)
    setPlaying(false)

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      markersRef.current = null
      setHovered(null)
    }
  }, [candles])

  // Aplica os candles até playheadIndex
  useEffect(() => {
    if (!seriesRef.current || !candles) return
    seriesRef.current.setData(candles.slice(0, playheadIndex))
    if (playheadIndex > 0 && chartRef.current) {
      const last = candles[playheadIndex - 1].time as number
      const visibleCount = Math.min(120, playheadIndex)
      const from =
        playheadIndex > visibleCount
          ? (candles[playheadIndex - visibleCount].time as number)
          : (candles[0].time as number)
      chartRef.current.timeScale().setVisibleRange({
        from: from as Time,
        to: last as Time,
      })
    }
  }, [candles, playheadIndex])

  // Aplica markers
  useEffect(() => {
    markersRef.current?.setMarkers(visibleMarkers)
  }, [visibleMarkers])

  // Loop de avanço
  useEffect(() => {
    if (!playing || !candles) return
    const stepMs =
      speed === "max" ? 0 : speed === 1 ? 1000 : speed === 4 ? 250 : 60
    const id = window.setInterval(() => {
      setPlayheadIndex((i) => {
        if (i >= total) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, stepMs)
    return () => window.clearInterval(id)
  }, [playing, speed, candles, total])

  function jumpToNextTrade() {
    if (!candles) return
    const cur = currentTimeSec ?? 0
    const upcoming = trades
      .map((t) => Math.floor(t.entryTime / 1000))
      .filter((sec) => sec > cur)
      .sort((a, b) => a - b)[0]
    if (!upcoming) return
    // Acha o índice do candle cujo time >= upcoming
    const idx = candles.findIndex((c) => (c.time as number) >= upcoming)
    if (idx >= 0) setPlayheadIndex(idx + 1)
  }

  function reset() {
    setPlaying(false)
    setPlayheadIndex(0)
  }

  if (!candles) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-muted-foreground"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  }
  if (candles.length === 0) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-muted-foreground text-sm"
      >
        Sem candles para reproduzir.
      </div>
    )
  }

  const progress = total > 0 ? (playheadIndex / total) * 100 : 0
  const tradesHit = trades.filter((t) => {
    const sec = Math.floor(t.exitTime / 1000)
    return currentTimeSec != null && sec <= currentTimeSec
  })
  const realized = tradesHit.reduce((acc, t) => acc + t.result, 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={playing ? "secondary" : "default"}
          onClick={() => setPlaying((p) => !p)}
          disabled={playheadIndex >= total}
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {playing ? "Pausar" : playheadIndex >= total ? "Fim" : "Reproduzir"}
        </Button>
        <Button size="sm" variant="outline" onClick={reset} disabled={playheadIndex === 0}>
          <Square className="h-4 w-4" />
          Reiniciar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={jumpToNextTrade}
          disabled={playheadIndex === 0}
        >
          <SkipForward className="h-4 w-4" />
          Próximo trade
        </Button>

        <div className="flex items-center gap-1 ml-2">
          {([1, 4, 16, "max"] as Speed[]).map((s) => (
            <Button
              key={String(s)}
              size="sm"
              variant={speed === s ? "default" : "outline"}
              onClick={() => setSpeed(s)}
            >
              {s === "max" ? "máx" : `${s}x`}
            </Button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs">
          <Badge variant="outline">
            {playheadIndex}/{total} candles
          </Badge>
          <Badge variant="outline">
            {tradesHit.length}/{trades.length} trades
          </Badge>
          <Badge
            variant="outline"
            className={
              realized >= 0 ? "text-emerald-500" : "text-destructive"
            }
          >
            {realized >= 0 ? "+" : ""}
            {realized.toFixed(0)} pts
          </Badge>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={total}
        value={playheadIndex}
        onChange={(e) => {
          setPlaying(false)
          setPlayheadIndex(Number(e.target.value))
        }}
        className="w-full accent-primary"
      />
      <div className="text-[11px] text-muted-foreground font-mono tabular-nums flex justify-between">
        <span>
          {currentTimeSec
            ? new Date(currentTimeSec * 1000).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
        <span>{progress.toFixed(0)}%</span>
      </div>

      <div className="relative">
        <div ref={containerRef} style={{ height }} className="w-full" />
        {hovered && <OhlcOverlay candle={hovered} />}
      </div>
    </div>
  )
}

function OhlcOverlay({ candle }: { candle: CandlestickData }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  const isGreen = candle.close >= candle.open
  return (
    <div className="absolute left-2 top-2 rounded-md bg-background/85 backdrop-blur px-2 py-1 text-[11px] font-mono pointer-events-none border border-border">
      <span className="text-muted-foreground">O </span>
      <span className="tabular-nums">{fmt(candle.open)}</span>
      <span className="text-muted-foreground"> H </span>
      <span className="tabular-nums">{fmt(candle.high)}</span>
      <span className="text-muted-foreground"> L </span>
      <span className="tabular-nums">{fmt(candle.low)}</span>
      <span className="text-muted-foreground"> C </span>
      <span className={`tabular-nums ${isGreen ? "text-emerald-500" : "text-destructive"}`}>
        {fmt(candle.close)}
      </span>
    </div>
  )
}
