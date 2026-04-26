"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, Bell, ChevronRight, Loader2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"
import type { SourceId } from "@/types"

type RuleRow = {
  id: string
  name: string
  description: string
  symbol: string
  tf: string
  active: boolean
  source_pref: SourceId | null
  created_at: string
}

type CandleSnapshot = {
  time: number
  close: number
  source: string
}

type AlertSnapshot = {
  triggered_at: string
  price: number
  direction: string | null
}

type RuleVitals = {
  lastCandle: CandleSnapshot | null
  lastAlert: AlertSnapshot | null
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatTime(epochMsOrIso: number | string): string {
  return new Date(epochMsOrIso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [vitals, setVitals] = useState<Record<string, RuleVitals>>({})
  const [alertsToday, setAlertsToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: ruleRows, error: ruleErr } = await supabase
        .from("rules")
        .select("id, name, description, symbol, tf, active, source_pref, created_at")
        .order("active", { ascending: false })
        .order("created_at", { ascending: false })

      if (!mounted) return
      if (ruleErr) {
        setError(ruleErr.message)
        setLoading(false)
        return
      }

      const list = (ruleRows ?? []) as RuleRow[]
      setRules(list)

      // For each rule, fetch latest candle and latest alert in parallel
      const results = await Promise.all(
        list.map(async (r) => {
          const source = r.source_pref ?? "mt5"
          const [candleRes, alertRes] = await Promise.all([
            supabase
              .from("candles_history")
              .select("time, close, source")
              .eq("symbol", r.symbol)
              .eq("tf", r.tf)
              .eq("source", source)
              .order("time", { ascending: false })
              .limit(1)
              .maybeSingle(),
            supabase
              .from("alerts")
              .select("triggered_at, price, direction")
              .eq("rule_id", r.id)
              .order("triggered_at", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ])
          return [
            r.id,
            {
              lastCandle: candleRes.data
                ? {
                    time: Number(candleRes.data.time),
                    close: Number(candleRes.data.close),
                    source: String(candleRes.data.source),
                  }
                : null,
              lastAlert: alertRes.data
                ? {
                    triggered_at: alertRes.data.triggered_at as string,
                    price: Number(alertRes.data.price),
                    direction: (alertRes.data.direction as string) ?? null,
                  }
                : null,
            },
          ] as const
        })
      )

      if (!mounted) return
      const map: Record<string, RuleVitals> = {}
      for (const [id, v] of results) map[id] = v
      setVitals(map)

      // Alerts today count
      const { count } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .gte("triggered_at", startOfTodayIso())
      if (!mounted) return
      setAlertsToday(count ?? 0)

      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  // Realtime: update lastCandle + lastAlert per rule
  useEffect(() => {
    if (rules.length === 0) return
    const channel = supabase
      .channel("dashboard-rules")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "candles_history" },
        (payload) => {
          const row = payload.new as {
            symbol: string
            tf: string
            source: string
            time: number
            close: number
          }
          setVitals((prev) => {
            const next = { ...prev }
            for (const r of rules) {
              const sourcePref = r.source_pref ?? "mt5"
              if (
                r.symbol === row.symbol &&
                r.tf === row.tf &&
                sourcePref === row.source
              ) {
                const cur = next[r.id]
                const incoming = {
                  time: Number(row.time),
                  close: Number(row.close),
                  source: String(row.source),
                }
                if (!cur?.lastCandle || incoming.time > cur.lastCandle.time) {
                  next[r.id] = { ...(cur ?? { lastAlert: null }), lastCandle: incoming }
                }
              }
            }
            return next
          })
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const row = payload.new as {
            rule_id: string
            triggered_at: string
            price: number
            direction: string | null
          }
          setVitals((prev) => {
            const cur = prev[row.rule_id]
            return {
              ...prev,
              [row.rule_id]: {
                ...(cur ?? { lastCandle: null }),
                lastAlert: {
                  triggered_at: row.triggered_at,
                  price: Number(row.price),
                  direction: row.direction,
                },
              },
            }
          })
          setAlertsToday((c) => c + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, rules])

  const activeCount = rules.filter((r) => r.active).length

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Monitores</h2>
          <Link href="/rules/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard
            label="Regras ativas"
            value={loading ? null : activeCount}
            icon={<Activity className="h-4 w-4" />}
          />
          <SummaryCard
            label="Total de regras"
            value={loading ? null : rules.length}
            icon={<Activity className="h-4 w-4" />}
          />
          <SummaryCard
            label="Alertas hoje"
            value={loading ? null : alertsToday}
            icon={<Bell className="h-4 w-4" />}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Você ainda não criou nenhuma regra.</p>
              <p className="text-xs mt-1">
                Crie sua primeira regra de trading em linguagem natural.
              </p>
              <Link href="/rules/new">
                <Button size="sm" className="mt-4">
                  <Plus className="h-4 w-4" />
                  Nova Regra
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lista de monitores</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {rules.map((rule) => {
                  const v = vitals[rule.id]
                  return (
                    <Link
                      key={rule.id}
                      href={`/rules/${rule.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium truncate">{rule.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {rule.symbol}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {rule.tf}
                          </Badge>
                          {rule.active ? (
                            <Badge className="text-xs">Ativa</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Pausada
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {rule.description}
                        </p>
                      </div>
                      <div className="hidden sm:block text-right text-xs shrink-0 min-w-[140px]">
                        <div className="text-muted-foreground">Último candle</div>
                        <div className="tabular-nums">
                          {v?.lastCandle ? formatPrice(v.lastCandle.close) : "—"}
                        </div>
                        <div className="text-muted-foreground">
                          {v?.lastCandle ? formatTime(v.lastCandle.time) : ""}
                        </div>
                      </div>
                      <div className="hidden md:block text-right text-xs shrink-0 min-w-[140px]">
                        <div className="text-muted-foreground">Último alerta</div>
                        <div className="tabular-nums">
                          {v?.lastAlert ? formatPrice(v.lastAlert.price) : "—"}
                        </div>
                        <div className="text-muted-foreground">
                          {v?.lastAlert ? formatTime(v.lastAlert.triggered_at) : "—"}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number | null
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">
          {value === null ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
        </div>
      </CardContent>
    </Card>
  )
}
