"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, Bell, ChevronRight, Loader2, Plus, Server, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
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
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
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
  }, [supabase, retryToken])

  // Realtime: alertas + candles atualizam vitals sem precisar F5.
  useEffect(() => {
    if (rules.length === 0) return

    // (account_id|symbol|tf) → ruleIds que monitoram esse combo.
    // Várias regras podem compartilhar o mesmo combo, então é lista.
    const candleKeyToRules = new Map<string, string[]>()
    for (const r of rules) {
      const key = `${r.account_id}|${r.symbol}|${r.tf}`
      const cur = candleKeyToRules.get(key) ?? []
      cur.push(r.id)
      candleKeyToRules.set(key, cur)
    }

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candles_history" },
        (payload) => {
          const row = payload.new as {
            account_id: string | null
            symbol: string
            tf: string
            time: number | string
            close: number | string
          }
          if (!row.account_id) return
          const ruleIds = candleKeyToRules.get(
            `${row.account_id}|${row.symbol}|${row.tf}`
          )
          if (!ruleIds?.length) return
          const snapshot: CandleSnapshot = {
            time: Number(row.time),
            close: Number(row.close),
          }
          setVitals((prev) => {
            const next = { ...prev }
            for (const id of ruleIds) {
              const cur = next[id]
              // Evita reverter pra um candle antigo se chegar fora de ordem.
              if (cur?.lastCandle && cur.lastCandle.time > snapshot.time) continue
              next[id] = {
                ...(cur ?? { lastAlert: null }),
                lastCandle: snapshot,
              }
            }
            return next
          })
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

      <main className="px-6 py-6 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Regras</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Suas regras ativas e o status delas em tempo real.
            </p>
          </div>
          <Link href="/rules/new">
            <Button>
              <Plus className="h-4 w-4" />
              Nova regra
            </Button>
          </Link>
        </header>

        <div className="space-y-6">
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

          {error ? (
            <Card>
              <ErrorState
                message={
                  <>
                    Não consegui carregar suas regras. {error}
                    <br />
                    Verifique sua conexão e tente novamente.
                  </>
                }
                onRetry={() => setRetryToken((t) => t + 1)}
                retrying={loading}
              />
            </Card>
          ) : loading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              </CardContent>
            </Card>
          ) : rules.length === 0 ? (
            <Card>
              {accounts.length === 0 ? (
                <EmptyState
                  icon={<Server className="h-5 w-5" />}
                  title="Cadastre uma conta MT5 para começar"
                  description={
                    <>
                      O Pulse acompanha candles do seu MetaTrader 5 e dispara
                      alertas no Telegram quando suas regras detectam o setup.
                      Comece adicionando a conta da sua corretora.
                    </>
                  }
                  primaryAction={{
                    label: "Cadastrar conta",
                    href: "/settings/accounts",
                    icon: <Plus className="h-4 w-4" />,
                  }}
                  secondaryAction={{
                    label: "Ver checklist de onboarding",
                    href: "/onboarding",
                  }}
                />
              ) : (
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Crie sua primeira regra"
                  description={
                    <>
                      Descreva em português o que o Pulse deve monitorar — por
                      exemplo, &ldquo;avise quando o RSI 14 cair abaixo de 30 em
                      WINFUT M5&rdquo;. O Claude transforma em lógica executável
                      e o motor passa a checar a cada candle.
                    </>
                  }
                  primaryAction={{
                    label: "Nova regra",
                    href: "/rules/new",
                    icon: <Plus className="h-4 w-4" />,
                  }}
                />
              )}
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
        </div>
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
              <Badge variant="outline" className="text-[11px] capitalize font-medium">
                {account.broker}
              </Badge>
              {isOnline ? (
                <Badge className="text-[11px] font-medium bg-emerald-500 text-white">
                  Online
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  Offline
                </Badge>
              )}
            </>
          ) : (
            <>
              <span>Sem conta vinculada</span>
              <Badge variant="secondary" className="text-[11px] font-medium">
                legacy
              </Badge>
            </>
          )}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {rules.length} {rules.length === 1 ? "regra" : "regras"}
        </span>
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
                  <div className="font-mono tabular-nums text-foreground">
                    {v?.lastCandle ? formatPrice(v.lastCandle.close) : "—"}
                  </div>
                  <div className="font-mono tabular-nums text-muted-foreground text-[11px]">
                    {v?.lastCandle ? formatTime(v.lastCandle.time) : ""}
                  </div>
                </div>
                <div className="hidden md:block text-right text-xs shrink-0 min-w-[140px]">
                  <div className="text-muted-foreground">Último alerta</div>
                  <div className="font-mono tabular-nums text-foreground">
                    {v?.lastAlert ? formatPrice(v.lastAlert.price) : "—"}
                  </div>
                  <div className="font-mono tabular-nums text-muted-foreground text-[11px]">
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
        <div className="text-3xl font-mono font-medium tabular-nums tracking-tight">
          {value === null ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
        </div>
      </CardContent>
    </Card>
  )
}
