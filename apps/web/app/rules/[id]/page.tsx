"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, BarChart3, Loader2, Pencil, Play, Save, Sparkles, X } from "lucide-react"
import type { CandlestickData, Time } from "lightweight-charts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { RuleChart, type ChartMarker } from "@/components/rule-chart"
import { createClient } from "@/lib/supabase"
import type { RuleLogic } from "@/types"

const AUTO_TF = "auto"

type RuleRow = {
  id: string
  user_id: string
  account_id: string
  name: string
  description: string
  symbol: string
  tf: string
  active: boolean
  logic_json: RuleLogic
  created_at: string
}

type AccountSummary = {
  id: string
  label: string
  broker: string
}

type AlertRow = {
  id: string
  rule_id: string
  source: string
  symbol: string
  price: number
  message: string
  direction: "compra" | "venda" | "neutro" | null
  triggered_at: string
}

function formatDateTime(value: string | number): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function alertToMarker(a: AlertRow): ChartMarker {
  const isBuy = a.direction === "compra"
  return {
    time: new Date(a.triggered_at).getTime(),
    position: isBuy ? "belowBar" : "aboveBar",
    color: isBuy ? "#10b981" : "#ef4444",
    shape: isBuy ? "arrowUp" : "arrowDown",
    text: isBuy ? "C" : a.direction === "venda" ? "V" : "•",
  }
}

export default function RuleDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [rule, setRule] = useState<RuleRow | null>(null)
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [accountTimeframes, setAccountTimeframes] = useState<string[]>([])
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [candles, setCandles] = useState<CandlestickData[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!params?.id) return
    let mounted = true
    async function load() {
      const { data: ruleData, error: ruleErr } = await supabase
        .from("rules")
        .select("*")
        .eq("id", params.id)
        .single()
      if (!mounted) return
      if (ruleErr || !ruleData) {
        setError(ruleErr?.message ?? "Regra não encontrada")
        setLoading(false)
        return
      }
      const r = ruleData as RuleRow
      setRule(r)

      const candlesQ = supabase
        .from("candles_history")
        .select("time, open, high, low, close")
        .eq("account_id", r.account_id)
        .eq("symbol", r.symbol)
        .eq("tf", r.tf)
        .order("time", { ascending: false })
        .limit(500)

      const accountQ = supabase
        .from("accounts")
        .select("id, label, broker, timeframes")
        .eq("id", r.account_id)
        .maybeSingle()

      const [candleRes, alertRes, accountRes] = await Promise.all([
        candlesQ,
        supabase
          .from("alerts")
          .select("*")
          .eq("rule_id", r.id)
          .order("triggered_at", { ascending: false })
          .limit(100),
        accountQ,
      ])
      if (!mounted) return

      if (candleRes.data?.length) {
        const sorted = [...candleRes.data].sort((a, b) => Number(a.time) - Number(b.time))
        const cs: CandlestickData[] = sorted
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
        setCandles(cs)
      } else {
        setCandles([])
      }

      setAlerts((alertRes.data ?? []) as AlertRow[])
      if (accountRes.data) {
        const acc = accountRes.data as AccountSummary & { timeframes: string[] }
        setAccount(acc)
        setAccountTimeframes(acc.timeframes ?? [])
      }
      setLoading(false)
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase, params?.id])

  useEffect(() => {
    if (!rule) return
    const channel = supabase
      .channel(`rule-${rule.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `rule_id=eq.${rule.id}`,
        },
        (payload) => {
          setAlerts((prev) => [payload.new as AlertRow, ...prev].slice(0, 100))
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candles_history",
          filter: `account_id=eq.${rule.account_id}`,
        },
        (payload) => {
          const row = payload.new as {
            symbol: string
            tf: string
            time: number | string
            open: number | string
            high: number | string
            low: number | string
            close: number | string
          }
          if (row.symbol !== rule.symbol || row.tf !== rule.tf) return
          const next: CandlestickData = {
            time: Math.floor(Number(row.time) / 1000) as Time,
            open: Number(row.open),
            high: Number(row.high),
            low: Number(row.low),
            close: Number(row.close),
          }
          setCandles((prev) => {
            if (!prev) return [next]
            const last = prev[prev.length - 1]
            if (last && last.time === next.time) {
              const copy = prev.slice()
              copy[copy.length - 1] = next
              return copy
            }
            // Ignora candles fora de ordem (anteriores ao último).
            if (last && (last.time as number) > (next.time as number)) return prev
            return [...prev, next]
          })
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, rule])

  async function toggleActive() {
    if (!rule) return
    setBusy(true)
    const { error: err } = await supabase
      .from("rules")
      .update({ active: !rule.active })
      .eq("id", rule.id)
    if (err) setError(err.message)
    else setRule({ ...rule, active: !rule.active })
    setBusy(false)
  }

  async function saveEdit(patch: {
    name: string
    description: string
    symbol: string
    tf: string
    logic_json: RuleLogic
  }) {
    if (!rule) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase
      .from("rules")
      .update(patch)
      .eq("id", rule.id)
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setRule({ ...rule, ...patch })
    setEditing(false)
  }

  const markers = useMemo(() => alerts.map(alertToMarker), [alerts])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="p-6 max-w-5xl mx-auto space-y-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-destructive text-sm">{error}</CardContent>
          </Card>
        ) : rule ? (
          <>
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{rule.name}</h2>
                      {account && (
                        <Badge variant="outline" className="text-xs">
                          {account.label}
                        </Badge>
                      )}
                      <Badge variant="outline">{rule.symbol}</Badge>
                      <Badge variant="outline">{rule.tf}</Badge>
                      {rule.active ? (
                        <Badge>Ativa</Badge>
                      ) : (
                        <Badge variant="secondary">Pausada</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{rule.description}</p>
                  </div>
                  <div className="flex shrink-0 gap-2 flex-wrap justify-end">
                    <Button
                      size="sm"
                      variant={rule.active ? "secondary" : "default"}
                      disabled={busy}
                      onClick={toggleActive}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : rule.active ? (
                        "Desativar"
                      ) : (
                        "Ativar"
                      )}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button size="sm" onClick={() => router.push(`/backtest?ruleId=${rule.id}`)}>
                      <Play className="h-4 w-4" />
                      Rodar backtest
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {editing && (
              <EditRuleForm
                rule={rule}
                accountTimeframes={accountTimeframes}
                onCancel={() => setEditing(false)}
                onSave={saveEdit}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Gráfico {rule.symbol} — {rule.tf}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RuleChart candles={candles} markers={markers} />
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <LegendDot color="#10b981" label="Alerta de compra" />
                  <LegendDot color="#ef4444" label="Alerta de venda" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Alertas recentes</CardTitle>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Esta regra ainda não disparou alertas.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b">
                          <th className="py-2 pr-3">Quando</th>
                          <th className="py-2 pr-3">Direção</th>
                          <th className="py-2 pr-3">Fonte</th>
                          <th className="py-2 pr-3 text-right">Preço</th>
                          <th className="py-2 pr-3">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map((a) => (
                          <tr key={a.id} className="border-b last:border-0">
                            <td className="py-2 pr-3 whitespace-nowrap">
                              {formatDateTime(a.triggered_at)}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge variant="outline" className="capitalize">
                                {a.direction ?? "—"}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">{a.source}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">
                              {formatPrice(a.price)}
                            </td>
                            <td className="py-2 pr-3 text-muted-foreground">{a.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Lógica (JSON gerado)</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-x-auto">
                  {JSON.stringify(rule.logic_json, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </>
        ) : null}
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

function EditRuleForm({
  rule,
  accountTimeframes,
  onCancel,
  onSave,
}: {
  rule: RuleRow
  accountTimeframes: string[]
  onCancel: () => void
  onSave: (patch: {
    name: string
    description: string
    symbol: string
    tf: string
    logic_json: RuleLogic
  }) => void | Promise<void>
}) {
  const [name, setName] = useState(rule.name)
  const [description, setDescription] = useState(rule.description)
  const [symbol, setSymbol] = useState(rule.symbol)
  const [timeframe, setTimeframe] = useState<string>(rule.tf)
  const [logic, setLogic] = useState<RuleLogic>(rule.logic_json)
  const [reinterpreting, setReinterpreting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [reinterpreted, setReinterpreted] = useState(false)

  async function reinterpret() {
    if (!description.trim()) return
    setReinterpreting(true)
    setErr(null)
    try {
      const isAuto = timeframe === AUTO_TF
      const body: Record<string, unknown> = { description, symbol }
      if (!isAuto) body.timeframe = timeframe
      if (isAuto && accountTimeframes.length > 0) body.availableTimeframes = accountTimeframes
      const res = await fetch("/api/analyze-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao reinterpretar")
      setLogic(data.logic)
      setReinterpreted(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setReinterpreting(false)
    }
  }

  async function submit() {
    setSaving(true)
    const finalTf =
      timeframe === AUTO_TF
        ? (logic.timeframe as string) || rule.tf
        : timeframe
    await onSave({
      name: name.trim() || rule.name,
      description: description.trim() || rule.description,
      symbol: symbol.trim().toUpperCase() || rule.symbol,
      tf: finalTf,
      logic_json: logic,
    })
    setSaving(false)
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-sm">Editar regra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Descrição (PT-BR)</label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setReinterpreted(false)
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Símbolo</label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Timeframe</label>
            <Select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value={AUTO_TF}>Auto (Claude decide)</option>
              <option value="M1">M1</option>
              <option value="M5">M5</option>
              <option value="M15">M15</option>
              <option value="M30">M30</option>
              <option value="H1">H1</option>
            </Select>
          </div>
        </div>
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={reinterpret}
            disabled={reinterpreting || !description.trim()}
          >
            {reinterpreting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {reinterpreting ? "Reinterpretando..." : "Reinterpretar com Claude"}
          </Button>
          {reinterpreted && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
              Lógica regenerada — clique em Salvar pra persistir.
            </p>
          )}
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <pre className="bg-secondary rounded-lg p-3 text-[11px] font-mono overflow-x-auto max-h-48">
          {JSON.stringify(logic, null, 2)}
        </pre>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
