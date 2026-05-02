"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"

type OS = "windows" | "mac" | "linux"

const OS_OPTIONS: { id: OS; label: string; hint: string }[] = [
  {
    id: "windows",
    label: "Windows",
    hint: "MT5 nativo. Recomendado.",
  },
  {
    id: "mac",
    label: "macOS",
    hint: "MT5 não tem build nativo — exige VM/Wine.",
  },
  {
    id: "linux",
    label: "Linux",
    hint: "MT5 não tem build nativo — exige Wine/Proton.",
  },
]

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `há ${Math.max(1, Math.floor(ms / 1000))}s`
  if (ms < 3_600_000) return `há ${Math.floor(ms / 60_000)} min`
  if (ms < 86_400_000) return `há ${Math.floor(ms / 3_600_000)}h`
  return `há ${Math.floor(ms / 86_400_000)}d`
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000

export default function AgentSettingsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [os, setOs] = useState<OS | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mt5LastSeen, setMt5LastSeen] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError("Sessão expirada.")
        setLoading(false)
        return
      }

      const [{ data: settings }, { data: source }] = await Promise.all([
        supabase
          .from("user_settings")
          .select("os")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("data_sources")
          .select("last_seen")
          .eq("id", "mt5")
          .maybeSingle(),
      ])

      if (!mounted) return
      setOs((settings?.os as OS | undefined) ?? null)
      setMt5LastSeen(source?.last_seen ?? null)
      setLoading(false)
    }
    load()
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [supabase])

  // Re-fetch só do last_seen periodicamente
  useEffect(() => {
    let cancelled = false
    if (loading) return
    supabase
      .from("data_sources")
      .select("last_seen")
      .eq("id", "mt5")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMt5LastSeen(data?.last_seen ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [tick, supabase, loading])

  async function selectOs(next: OS) {
    setSaving(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError("Sessão expirada.")
      setSaving(false)
      return
    }
    const { error: upErr } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, os: next }, { onConflict: "user_id" })
    setSaving(false)
    if (upErr) setError(upErr.message)
    else setOs(next)
  }

  async function downloadScript() {
    if (!os) return
    setDownloading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent/bootstrap-script?os=${os}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Falha ao gerar script")
      }
      const blob = await res.blob()
      const filename =
        res.headers
          .get("content-disposition")
          ?.match(/filename="(.+?)"/)?.[1] ?? "pulse-agent-start"
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setDownloading(false)
    }
  }

  const isOnline =
    mt5LastSeen &&
    Date.now() - new Date(mt5LastSeen).getTime() < STALE_THRESHOLD_MS

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>

        <h2 className="text-lg font-semibold">Agent local (MetaTrader 5)</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                {isOnline ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span>
                      Agent online — último heartbeat {formatRelative(mt5LastSeen)}.
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span>
                      Agent offline — último heartbeat {formatRelative(mt5LastSeen)}.
                    </span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">1. Sistema operacional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              O Pulse gera um script de inicialização específico para o seu SO.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {OS_OPTIONS.map((opt) => {
                const selected = os === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={saving}
                    onClick={() => selectOs(opt.id)}
                    className={`text-left rounded-lg border p-3 transition-colors ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    } ${saving ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm">{opt.label}</span>
                      {selected && (
                        <Badge variant="outline" className="text-[10px]">
                          atual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {opt.hint}
                    </p>
                  </button>
                )
              })}
            </div>
            {os === "mac" || os === "linux" ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  MetaTrader 5 não tem build nativo para {os === "mac" ? "macOS" : "Linux"}.
                  Você precisa rodar via VM Windows ou Wine.
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">2. Baixar script</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              O script verifica Python, cria venv, instala dependências, gera{" "}
              <code className="text-[11px]">.env</code> com seu token de ingest e
              {os === "windows" ? " abre o MT5" : " inicia o agent"}. Coloque o arquivo
              dentro de <code className="text-[11px]">apps/agent/</code> do repo
              clonado e execute.
            </p>
            <Button onClick={downloadScript} disabled={!os || downloading}>
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "Gerando..." : "Baixar script de inicialização"}
            </Button>
            {!os && (
              <p className="text-xs text-muted-foreground">
                Selecione o SO antes de baixar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3. Como rodar</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
              <li>
                Clone o repo do Pulse:{" "}
                <code className="text-[11px]">git clone &lt;repo-url&gt;</code>
              </li>
              <li>
                Coloque o script baixado dentro de{" "}
                <code className="text-[11px]">apps/agent/</code>.
              </li>
              <li>
                {os === "windows" ? (
                  <>Dê duplo clique no <code className="text-[11px]">.bat</code>.</>
                ) : os === "mac" ? (
                  <>
                    Abra o Terminal, dê{" "}
                    <code className="text-[11px]">chmod +x pulse-agent-start.command</code>
                    {" "}e execute.
                  </>
                ) : (
                  <>
                    No Terminal, dê{" "}
                    <code className="text-[11px]">chmod +x pulse-agent-start.sh</code>
                    {" "}e execute.
                  </>
                )}
              </li>
              <li>
                Faça login no MetaTrader 5 com sua conta — o agent passa a
                empurrar candles automaticamente.
              </li>
              <li>
                Volte aqui e confirme que o status virou{" "}
                <strong>Online</strong>.
              </li>
            </ol>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </main>
    </div>
  )
}
