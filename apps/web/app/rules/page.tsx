"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Pencil, Plus, Trash2, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"

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
  const [rules, setRules] = useState<RuleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    supabase
      .from("rules")
      .select("id, name, description, symbol, tf, active, created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) setError(error.message)
        else setRules((data ?? []) as RuleRow[])
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [supabase])

  async function toggleActive(rule: RuleRow) {
    setBusy(rule.id)
    setError(null)
    const { error } = await supabase
      .from("rules")
      .update({ active: !rule.active })
      .eq("id", rule.id)
    if (error) setError(error.message)
    else
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      )
    setBusy(null)
  }

  async function removeRule(rule: RuleRow) {
    if (!confirm(`Excluir a regra "${rule.name}"?`)) return
    setBusy(rule.id)
    setError(null)
    const { error } = await supabase.from("rules").delete().eq("id", rule.id)
    if (error) setError(error.message)
    else setRules((prev) => prev.filter((r) => r.id !== rule.id))
    setBusy(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Minhas Regras</h2>
          <Link href="/rules/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </Link>
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
              <p className="text-sm">Nenhuma regra criada ainda.</p>
              <p className="text-xs mt-1">
                Crie sua primeira regra de trading usando linguagem natural.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <Link href={`/rules/${rule.id}`} className="min-w-0 flex-1 hover:opacity-80 transition-opacity">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{rule.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {rule.symbol}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {rule.tf}
                        </Badge>
                        {rule.active && (
                          <Badge className="text-xs">Ativa</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {rule.description}
                      </p>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
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
                        onClick={() => removeRule(rule)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
