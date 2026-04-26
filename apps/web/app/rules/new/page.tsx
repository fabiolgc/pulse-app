"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Save, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"

export default function NewRulePage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [symbol, setSymbol] = useState("WINFUT")
  const [timeframe, setTimeframe] = useState("M5")
  const [logicJson, setLogicJson] = useState<Record<string, unknown> | null>(null)
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInterpret() {
    if (!description.trim()) return
    setIsInterpreting(true)
    setError(null)
    try {
      const res = await fetch("/api/analyze-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, symbol, timeframe }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao interpretar regra")
      setLogicJson(data.logic)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsInterpreting(false)
    }
  }

  async function handleSave() {
    if (!logicJson || !name.trim()) return
    setIsSaving(true)
    setError(null)
    const supabase = createClient()
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()
    if (userErr || !user) {
      setError("Sessão expirada. Faça login novamente.")
      setIsSaving(false)
      return
    }
    const { error: insertErr } = await supabase.from("rules").insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim(),
      logic_json: logicJson,
      symbol,
      tf: timeframe,
      active: false,
    })
    setIsSaving(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    router.push("/rules")
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <h2 className="text-lg font-semibold">Nova Regra de Trading</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Descreva sua regra em portugues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <label className="text-xs text-muted-foreground">Simbolo</label>
                <Select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                  <option value="WINFUT">WINFUT</option>
                  <option value="WDOFUT">WDOFUT</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Timeframe</label>
                <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                  <option value="M1">M1</option>
                  <option value="M5">M5</option>
                  <option value="M15">M15</option>
                  <option value="M30">M30</option>
                  <option value="H1">H1</option>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleInterpret}
              disabled={isInterpreting || !description.trim()}
            >
              <Sparkles className="h-4 w-4" />
              {isInterpreting ? "Interpretando..." : "Interpretar com Claude"}
            </Button>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>

        {logicJson && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">JSON Gerado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="bg-secondary rounded-lg p-4 text-xs font-mono overflow-x-auto">
                {JSON.stringify(logicJson, null, 2)}
              </pre>
              <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Salvando..." : "Salvar Regra"}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
