"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Server, Sparkles, Save, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { AppHeader } from "@/components/app-header"
import { EmptyState } from "@/components/empty-state"
import { RuleLogicSummary } from "@/components/rule-logic-summary"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/lib/toast"
import type { RuleLogic } from "@/types"

type AccountOption = {
  id: string
  label: string
  broker: string
  timeframes: string[]
}

const AUTO_TF = "auto"

export default function NewRulePage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [accountId, setAccountId] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [symbol, setSymbol] = useState("WINFUT")
  const [timeframe, setTimeframe] = useState<string>(AUTO_TF)
  const [logicJson, setLogicJson] = useState<RuleLogic | null>(null)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    supabase
      .from("accounts")
      .select("id, label, broker, timeframes")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!mounted) return
        const list = (data ?? []) as AccountOption[]
        setAccounts(list)
        if (list[0]) setAccountId(list[0].id)
        setLoadingAccounts(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase])

  const selectedAccount = accounts.find((a) => a.id === accountId)

  async function handleInterpret() {
    if (!description.trim()) return
    setIsInterpreting(true)
    setError(null)
    try {
      const isAuto = timeframe === AUTO_TF
      const body: Record<string, unknown> = { description, symbol }
      if (!isAuto) body.timeframe = timeframe
      if (isAuto && selectedAccount?.timeframes?.length) {
        body.availableTimeframes = selectedAccount.timeframes
      }
      const res = await fetch("/api/analyze-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao interpretar regra")
      setLogicJson(data.logic as RuleLogic)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsInterpreting(false)
    }
  }

  async function handleSave() {
    if (!logicJson || !name.trim() || !accountId) return
    setIsSaving(true)
    setError(null)
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      setError("Sessão expirada. Faça login novamente.")
      setIsSaving(false)
      return
    }
    // Quando Auto, usa o timeframe que o Claude escolheu (vem em logicJson.timeframe)
    const finalTf =
      timeframe === AUTO_TF
        ? (logicJson.timeframe as string) || "M15"
        : timeframe
    const { data: inserted, error: insertErr } = await supabase
      .from("rules")
      .insert({
        user_id: user.id,
        account_id: accountId,
        name: name.trim(),
        description: description.trim(),
        logic_json: logicJson,
        symbol,
        tf: finalTf,
        active: false,
      })
      .select("id")
      .single()
    setIsSaving(false)
    if (insertErr || !inserted) {
      const msg = insertErr?.message ?? "Erro ao salvar"
      setError(msg)
      toast.error(`Não consegui salvar: ${msg}`)
      return
    }
    toast.success(`${name.trim()} criada — pausada por padrão`)
    router.push(`/rules/${inserted.id}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="px-6 py-6 max-w-3xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Nova regra</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Descreva em português; Claude transforma em lógica executável.
          </p>
        </header>

        <div className="space-y-6">

        {!loadingAccounts && accounts.length === 0 && (
          <Card>
            <EmptyState
              icon={<Server className="h-5 w-5" />}
              title="Cadastre uma conta MT5 primeiro"
              description={
                <>
                  Regras precisam saber qual conta monitorar — os candles vêm
                  do agent local rodando ao lado do MT5 dessa conta.
                </>
              }
              primaryAction={{
                label: "Cadastrar conta",
                href: "/settings/accounts",
                icon: <Plus className="h-4 w-4" />,
              }}
            />
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Descreva sua regra em português</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Conta</label>
              <Select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={loadingAccounts || accounts.length === 0}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} ({a.broker})
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                A regra usará os candles dessa conta. Símbolos disponíveis dependem
                da corretora.
              </p>
            </div>
            <Input
              placeholder="Nome da regra (ex: RSI Oversold + EMA Cross)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Textarea
              placeholder="Ex: Compra quando RSI 14 estiver abaixo de 30 e EMA 9 cruzar acima da EMA 21, no timeframe M5. Stop de 200 pontos e gain de 400 pontos."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <div className="flex gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Símbolo</label>
                <Input
                  list="symbols-suggestions"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  placeholder="WINFUT, XAUUSD, EURUSD…"
                />
                <datalist id="symbols-suggestions">
                  <option value="WINFUT" />
                  <option value="WDOFUT" />
                  <option value="XAUUSD" />
                  <option value="EURUSD" />
                  <option value="GBPUSD" />
                  <option value="BTCUSD" />
                </datalist>
                <p className="text-[11px] text-muted-foreground">
                  Use o nome exato como aparece no Market Watch do MT5 (com sufixo
                  se houver).
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Timeframe</label>
                <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                  <option value={AUTO_TF}>Auto (Claude decide)</option>
                  <option value="M1">M1</option>
                  <option value="M5">M5</option>
                  <option value="M15">M15</option>
                  <option value="M30">M30</option>
                  <option value="H1">H1</option>
                </Select>
              </div>
            </div>

            <Button onClick={handleInterpret} disabled={isInterpreting || !description.trim()}>
              <Sparkles className="h-4 w-4" />
              {isInterpreting ? "Interpretando..." : "Interpretar com Claude"}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        {logicJson && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-sm">Confira o que a regra vai fazer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {timeframe === AUTO_TF && logicJson.timeframe ? (
                <p className="text-xs text-muted-foreground">
                  Claude escolheu o timeframe{" "}
                  <span className="font-mono text-foreground">{String(logicJson.timeframe)}</span>{" "}
                  com base na estratégia descrita.
                </p>
              ) : null}
              <RuleLogicSummary logic={logicJson} />
              <Button
                onClick={handleSave}
                disabled={!name.trim() || !accountId || isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Salvando..." : "Salvar regra"}
              </Button>
            </CardContent>
          </Card>
        )}
        </div>
      </main>
    </div>
  )
}
