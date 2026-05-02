"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, Bell, ChevronRight, Loader2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"

type AccountRow = {
  id: string
  label: string
  broker: string
  last_seen: string | null
}

type RuleRow = {
  id: string
  name: string
  description: string
  symbol: string
  tf: string
  active: boolean
  account_id: string
  created_at: string
}

type AlertSnapshot = {
  triggered_at: string
  price: number
  direction: string | null
}

type CandleSnapshot = {
  time: number
  close: number
}

type RuleVitals = {
  lastCandle: CandleSnapshot | null
  lastAlert: AlertSnapshot | null
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000

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
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [rules, setRules] = useState<RuleRow[]>([])
  const [vitals, setVitals] = useState<Record<string, RuleVitals>>({})
  const [alertsToday, setAlertsToday] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const [accRes, ruleRes] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, label, broker, last_seen")
          .order("created_at", { ascending: true }),
        supabase
          .from("rules")
          .select("id, name, description, symbol, tf, active, account_id, created_at")
          .order("active", { ascending: false })
          .order("created_at", { ascending: false }),
      ])

      if (!mounted) return
      if (accRes.error) {
        setError(accRes.error.message)
        setLoading(false)
        return
      }
      if (ruleRes.error) {
        setError(ruleRes.error.message)
        setLoading(false)
        return
      }

      const accList = (accRes.data ?? []) as AccountRow[]
      const ruleList = (ruleRes.data ?? []) as RuleRow[]
      setAccounts(accList)
      setRules(ruleList)

      const results = await Promise.all(
        ruleList.map(async (r) => {
          const candleQ = supabase
            .from("candles_history")
            .select("time, close")
            .eq("account_id", r.account_id)
            .eq("symbol", r.symbol)
            .eq("tf", r.tf)
            .order("time", { ascending: false })
            .limit(1)

          const [candleRes, alertRes] = await Promise.all([
            candleQ.maybeSingle(),
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

  // Realtime: alertas atualizam vitals
  useEffect(() => {
    if (rules.length === 0) return
    const channel = supabase
      .channel("dashboard-rules")
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

  // Agrupar regras por conta
  const grouped = useMemo(() => {
    const groups = new Map<string, RuleRow[]>()
    for (const r of rules) {
      if (!groups.has(r.account_id)) groups.set(r.account_id, [])
      groups.get(r.account_id)!.push(r)
    }
    return groups
  }, [rules])

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

        {error && <p className="text-sm text-destructive">{error}</p>}

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
                {accounts.length === 0
                  ? "Cadastre uma conta MT5 antes de criar regras."
                  : "Crie sua primeira regra de trading em linguagem natural."}
              </p>
              <Link href={accounts.length === 0 ? "/settings/accounts" : "/rules/new"}>
                <Button size="sm" className="mt-4">
                  <Plus className="h-4 w-4" />
                  {accounts.length === 0 ? "Cadastrar conta" : "Nova Regra"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([accountId, accountRules]) => (
              <AccountGroup
                key={accountId}
                account={accounts.find((a) => a.id === accountId) ?? null}
                rules={accountRules}
                vitals={vitals}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function AccountGroup({
  account,
  rules,
  vitals,
}: {
  account: AccountRow | null
  rules: RuleRow[]
  vitals: Record<string, RuleVitals>
}) {
  const isOnline =
    account?.last_seen &&
    Date.now() - new Date(account.last_seen).getTime() < STALE_THRESHOLD_MS

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          {account ? (
            <>
              <span>{account.label}</span>
              <Badge variant="outline" className="text-[10px] capitalize">
                {account.broker}
              </Badge>
              {isOnline ? (
                <Badge className="text-[10px] bg-emerald-500 text-white">Online</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">Offline</Badge>
              )}
            </>
          ) : (
            <>
              <span>Sem conta vinculada</span>
              <Badge variant="secondary" className="text-[10px]">legacy</Badge>
            </>
          )}
        </CardTitle>
        <span className="text-xs text-muted-foreground">{rules.length} monitor(es)</span>
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
                    <Badge variant="outline" className="text-xs">{rule.symbol}</Badge>
                    <Badge variant="outline" className="text-xs">{rule.tf}</Badge>
                    {rule.active ? (
                      <Badge className="text-xs">Ativa</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Pausada</Badge>
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
