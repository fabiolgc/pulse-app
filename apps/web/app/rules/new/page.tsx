"use client"

import { useState } from "react"
import { Activity, Sparkles, Save } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

export default function NewRulePage() {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [symbol, setSymbol] = useState("WINFUT")
  const [timeframe, setTimeframe] = useState("M5")
  const [logicJson, setLogicJson] = useState<object | null>(null)
  const [isInterpreting, setIsInterpreting] = useState(false)
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
    // TODO: implement save to Supabase with auth
    alert("Save implementado na proxima iteracao (requer auth)")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Pulse</h1>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <a href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</a>
            <a href="/rules" className="font-medium text-foreground">Regras</a>
            <a href="/backtest" className="text-muted-foreground hover:text-foreground">Backtest</a>
            <a href="/settings" className="text-muted-foreground hover:text-foreground">Settings</a>
          </nav>
        </div>
      </header>

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
              <Button onClick={handleSave} disabled={!name.trim()}>
                <Save className="h-4 w-4" />
                Salvar Regra
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
