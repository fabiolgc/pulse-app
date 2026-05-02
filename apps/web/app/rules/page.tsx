"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Search, Sparkles, Trash2, Loader2, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { EmptyState } from "@/components/empty-state"
import { ErrorState } from "@/components/error-state"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/lib/toast"

type RuleRow = {
  id: string
  name: string
  description: string
  symbol: string
  tf: string
  active: boolean
  created_at: string
}

export default function RulesPage() {
  const supabase = useMemo(() => createClient(), [])
  const toast = useToast()
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [armedDelete, setArmedDelete] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setLoadError(null)
    supabase
      .from("rules")
      .select("id, name, description, symbol, tf, active, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) setLoadError(error.message)
        else setRules((data ?? []) as RuleRow[])
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase, retryToken])

  async function toggleActive(rule: RuleRow) {
    setBusy(rule.id)
    setActionError(null)
    const wasActive = rule.active
    const { error } = await supabase
      .from("rules")
      .update({ active: !wasActive })
      .eq("id", rule.id)
    if (error) {
      setActionError(error.message)
      toast.error(`Não consegui ${wasActive ? "desativar" : "ativar"}: ${error.message}`)
    } else {
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      )
      toast.success(
        wasActive
          ? `${rule.name} pausada`
          : `${rule.name} ativada — vai disparar no próximo candle`
      )
    }
    setBusy(null)
  }

  async function removeRule(rule: RuleRow) {
    setArmedDelete(null)
    setBusy(rule.id)
    setActionError(null)
    const { error } = await supabase.from("rules").delete().eq("id", rule.id)
    if (error) {
      setActionError(error.message)
      toast.error(`Não consegui excluir: ${error.message}`)
    } else {
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
      toast.success(`${rule.name} excluída`)
    }
    setBusy(null)
  }

  const filteredRules = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rules
    return rules.filter((r) => {
      return (
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.symbol.toLowerCase().includes(q) ||
        r.tf.toLowerCase().includes(q)
      )
    })
  }, [rules, query])

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="px-6 py-6 max-w-7xl mx-auto">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Regras</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Lista completa, edite ou exclua regras existentes.
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
          {actionError && (
            <p className="text-sm text-destructive">{actionError}</p>
          )}
          {loadError ? (
            <Card>
              <ErrorState
                message={
                  <>
                    Não consegui carregar suas regras. {loadError}
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
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="Nenhuma regra criada ainda"
                description={
                  <>
                    Cada regra é descrita em português e executada candle a
                    candle. Crie a primeira para começar a receber alertas no
                    Telegram.
                  </>
                }
                primaryAction={{
                  label: "Nova regra",
                  href: "/rules/new",
                  icon: <Plus className="h-4 w-4" />,
                }}
              />
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar por nome, símbolo, timeframe…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                      aria-label="Limpar busca"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {query
                    ? `${filteredRules.length} de ${rules.length}`
                    : `${rules.length} ${rules.length === 1 ? "regra" : "regras"}`}
                </span>
              </div>

              {filteredRules.length === 0 ? (
                <Card>
                  <div className="py-10 px-6 text-center">
                    <p className="text-sm font-medium">Nenhuma regra encontrada</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Não há regras que casem com{" "}
                      <span className="font-mono">&ldquo;{query}&rdquo;</span>.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      onClick={() => setQuery("")}
                    >
                      Limpar busca
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {filteredRules.map((rule) => {
                const isArmed = armedDelete === rule.id
                return (
                  <Card key={rule.id}>
                    <CardContent className="py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <Link
                          href={`/rules/${rule.id}`}
                          className="min-w-0 flex-1 hover:opacity-80 transition-opacity"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{rule.name}</h3>
                            <Badge variant="outline" className="text-xs">
                              {rule.symbol}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {rule.tf}
                            </Badge>
                            {rule.active && <Badge className="text-xs">Ativa</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {rule.description}
                          </p>
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {isArmed ? (
                            <>
                              <span className="text-xs text-muted-foreground hidden sm:inline">
                                Excluir esta regra?
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setArmedDelete(null)}
                                disabled={busy === rule.id}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeRule(rule)}
                                disabled={busy === rule.id}
                              >
                                {busy === rule.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                Excluir
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant={rule.active ? "secondary" : "default"}
                                disabled={busy === rule.id}
                                onClick={() => toggleActive(rule)}
                              >
                                {busy === rule.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : rule.active ? (
                                  "Desativar"
                                ) : (
                                  "Ativar"
                                )}
                              </Button>
                              <Link href={`/rules/${rule.id}`}>
                                <Button size="sm" variant="outline" title="Editar / detalhes">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy === rule.id}
                                onClick={() => setArmedDelete(rule.id)}
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
