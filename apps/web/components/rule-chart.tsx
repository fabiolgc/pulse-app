"use client"

import { useEffect, useRef, useState } from "react"
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ChartMarker {
  /** epoch ms */
  time: number
  position: "aboveBar" | "belowBar" | "inBar"
  color: string
  shape: "arrowUp" | "arrowDown" | "circle" | "square"
  text?: string
}

interface RuleChartProps {
  candles: CandlestickData[] | null
  markers?: ChartMarker[]
  /** When set (epoch ms tuple), the chart zooms to this range. */
  focusRange?: [number, number] | null
  height?: number
  /** Show "1D / 5D / 1M / Tudo" toolbar above chart. Default true. */
  showToolbar?: boolean
}

export function RuleChart({
  candles,
  markers = [],
  focusRange = null,
  height = 420,
  showToolbar = true,
}: RuleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const [hovered, setHovered] = useState<CandlestickData | null>(null)

  // Build chart when candles arrive
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
    series.setData(candles)

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHovered(null)
        return
      }
      const data = param.seriesData.get(series) as CandlestickData | undefined
      setHovered(data ?? null)
    })

    chart.timeScale().fitContent()
    chartRef.current = chart
    seriesRef.current = series
    markersRef.current = createSeriesMarkers(series, [])

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      markersRef.current = null
      setHovered(null)
    }
  }, [candles])

  // Push markers
  useEffect(() => {
    if (!markersRef.current) return
    const sorted: SeriesMarker<Time>[] = [...markers]
      .map((m) => ({
        time: Math.floor(m.time / 1000) as Time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))
    markersRef.current.setMarkers(sorted)
  }, [markers])

  // Apply focusRange
  useEffect(() => {
    if (!chartRef.current || !focusRange) return
    const [fromMs, toMs] = focusRange
    chartRef.current.timeScale().setVisibleRange({
      from: Math.floor(fromMs / 1000) as Time,
      to: Math.floor(toMs / 1000) as Time,
    })
  }, [focusRange])

  function zoomLastDays(days: number) {
    if (!chartRef.current || !candles?.length) return
    const last = candles[candles.length - 1].time as number
    const from = (last - days * 86400) as Time
    chartRef.current.timeScale().setVisibleRange({ from, to: last as Time })
  }

  function zoomReset() {
    chartRef.current?.timeScale().fitContent()
  }

  return (
    <div className="space-y-3">
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => zoomLastDays(1)}>
            1D
          </Button>
          <Button size="sm" variant="outline" onClick={() => zoomLastDays(5)}>
            5D
          </Button>
          <Button size="sm" variant="outline" onClick={() => zoomLastDays(30)}>
            1M
          </Button>
          <Button size="sm" variant="outline" onClick={zoomReset}>
            Tudo
          </Button>
        </div>
      )}
      {candles && candles.length > 0 ? (
        <div className="relative">
          <div ref={containerRef} style={{ height }} className="w-full" />
          {hovered && <OhlcOverlay candle={hovered} />}
        </div>
      ) : (
        <div
          style={{ height }}
          className="flex items-center justify-center text-muted-foreground"
        >
          {candles === null ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <p className="text-sm">Sem candles para exibir.</p>
          )}
        </div>
      )}
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
