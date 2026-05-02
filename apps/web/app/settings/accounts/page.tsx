"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCcw,
  Save,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"
import type { AccountBroker, AccountType } from "@/types"

type AccountRow = {
  id: string
  label: string
  broker: AccountBroker
  account_type: AccountType
  mt5_path: string | null
  last_seen: string | null
  active: boolean
  created_at: string
}

type AgentPackage = { filename: string; base64: string }

type RevealedSecret = {
  accountId: string
  label: string
  token: string
  package: AgentPackage
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000

const BROKERS: { id: AccountBroker; label: string; defaultPath: string | null }[] = [
  { id: "xp", label: "XP Investimentos", defaultPath: "C:\\Program Files\\XP MT5\\terminal64.exe" },
  { id: "hantec", label: "Hantec Markets", defaultPath: "C:\\Program Files\\Hantec MT5\\terminal64.exe" },
  { id: "other", label: "Outro", defaultPath: "" },
]

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca"
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return `há ${Math.max(1, Math.floor(ms / 1000))}s`
  if (ms < 3_600_000) return `há ${Math.floor(ms / 60_000)} min`
  if (ms < 86_400_000) return `há ${Math.floor(ms / 3_600_000)}h`
  return `há ${Math.floor(ms / 86_400_000)}d`
}

export default function AccountsPage() {
  const supabase = useMemo(() => createClient(), [])
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<RevealedSecret | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("broker", { ascending: true })
        .order("account_type", { ascending: true })
      if (!mounted) return
      if (error) setError(error.message)
      else setAccounts((data ?? []) as AccountRow[])
      setLoading(false)
    }
    load()
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [supabase])

  useEffect(() => {
    if (tick === 0) return
    let cancelled = false
    supabase
      .from("accounts")
      .select("*")
      .order("broker", { ascending: true })
      .order("account_type", { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setAccounts(data as AccountRow[])
      })
    return () => {
      cancelled = true
    }
  }, [tick, supabase])

  async function regenerateToken(id: string, label: string) {
    setError(null)
    const res = await fetch(`/api/accounts/${id}/regenerate-token`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Erro ao regerar token")
      return
    }
    setRevealed({ accountId: id, label, token: data.token, package: data.package })
  }

  async function deleteAccount(id: string, label: string) {
    if (!confirm(`Excluir a conta "${label}"? Regras, alertas e candles ligados a ela serão removidos.`)) return
    const { error } = await supabase.from("accounts").delete().eq("id", id)
    if (error) setError(error.message)
    else setAccounts((prev) => prev.filter((a) => a.id !== id))
  }

  async function saveEdit(
    id: string,
    patch: { label: string; mt5_path: string | null }
  ) {
    setError(null)
    const { error } = await supabase
      .from("accounts")
      .update({ label: patch.label, mt5_path: patch.mt5_path })
      .eq("id", id)
    if (error) {
      setError(error.message)
      return
    }
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a))
    )
    setEditingId(null)
  }

  async function toggleActive(id: string) {
    setError(null)
    const target = accounts.find((a) => a.id === id)
    if (!target) return
    const { error } = await supabase
      .from("accounts")
      .update({ active: !target.active })
      .eq("id", id)
    if (error) {
      setError(error.message)
      return
    }
    // Trigger no DB pode ter desativado outras do mesmo broker; recarrega tudo.
    const { data } = await supabase
      .from("accounts")
      .select("*")
      .order("broker", { ascending: true })
      .order("account_type", { ascending: true })
    if (data) setAccounts(data as AccountRow[])
  }

  async function handleCreated(payload: RevealedSecret, account: AccountRow) {
    setAccounts((prev) => [...prev, account])
    setRevealed(payload)
    setShowAdd(false)
  }

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

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Contas MT5</h2>
          {!showAdd && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              Adicionar conta
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Cada corretora pode ter Real e Demo cadastradas, mas <strong>só uma fica
          ativa por vez</strong>. Ativar Demo automaticamente desativa Real (e
          vice-versa). Apenas a conta ativa dispara regras.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {showAdd && (
          <AddAccountForm
            existing={accounts}
            onCancel={() => setShowAdd(false)}
            onCreated={handleCreated}
            onError={setError}
          />
        )}

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </CardContent>
          </Card>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Nenhuma conta cadastrada ainda.</p>
              <p className="text-xs mt-1">
                Cadastre uma conta MT5 (XP, Hantec, etc) pra começar a empurrar
                candles e disparar regras.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {accounts.map((a) =>
              editingId === a.id ? (
                <EditAccountForm
                  key={a.id}
                  account={a}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => saveEdit(a.id, patch)}
                />
              ) : (
                <AccountCard
                  key={a.id}
                  account={a}
                  onEdit={() => setEditingId(a.id)}
                  onToggleActive={() => toggleActive(a.id)}
                  onRegenerate={() => regenerateToken(a.id, a.label)}
                  onDelete={() => deleteAccount(a.id, a.label)}
                />
              )
            )}
          </div>
        )}
      </main>

      {revealed && (
        <RevealedSecretModal secret={revealed} onClose={() => setRevealed(null)} />
      )}
    </div>
  )
}

function AccountCard({
  account,
  onEdit,
  onToggleActive,
  onRegenerate,
  onDelete,
}: {
  account: AccountRow
  onEdit: () => void
  onToggleActive: () => void | Promise<void>
  onRegenerate: () => void | Promise<void>
  onDelete: () => void | Promise<void>
}) {
  const isOnline =
    account.last_seen &&
    Date.now() - new Date(account.last_seen).getTime() < STALE_THRESHOLD_MS

  const brokerLabel =
    BROKERS.find((b) => b.id === account.broker)?.label ?? account.broker

  return (
    <Card className={account.active ? "border-emerald-500/40" : undefined}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium">{account.label}</h3>
              <Badge variant="outline" className="text-xs">{brokerLabel}</Badge>
              <Badge
                variant="outline"
                className={`text-xs capitalize ${
                  account.account_type === "real"
                    ? "border-blue-500/60 text-blue-600 dark:text-blue-400"
                    : "border-purple-500/60 text-purple-600 dark:text-purple-400"
                }`}
              >
                {account.account_type}
              </Badge>
              {account.active ? (
                <Badge className="text-xs bg-emerald-500 text-white">Ativa</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Inativa</Badge>
              )}
              {account.active && (
                isOnline ? (
                  <Badge className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Online
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs inline-flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Offline
                  </Badge>
                )
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Último heartbeat {formatRelative(account.last_seen)}
              {account.mt5_path && ` · ${account.mt5_path}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2 flex-wrap justify-end">
            <Button
              size="sm"
              variant={account.active ? "secondary" : "default"}
              onClick={onToggleActive}
              title={account.active ? "Desativar" : "Ativar (desativa a outra do mesmo broker)"}
            >
              <Power className="h-4 w-4" />
              {account.active ? "Desativar" : "Ativar"}
            </Button>
            <Button size="sm" variant="outline" onClick={onRegenerate} title="Gerar novo token e baixar pacote .zip">
              <RefreshCcw className="h-4 w-4" />
              Novo .zip
            </Button>
            <Button size="sm" variant="ghost" onClick={onEdit} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EditAccountForm({
  account,
  onCancel,
  onSave,
}: {
  account: AccountRow
  onCancel: () => void
  onSave: (patch: { label: string; mt5_path: string | null }) => void | Promise<void>
}) {
  const [label, setLabel] = useState(account.label)
  const [mt5Path, setMt5Path] = useState(account.mt5_path ?? "")
  const [saving, setSaving] = useState(false)

  async function submit() {
    setSaving(true)
    await onSave({
      label: label.trim() || account.label,
      mt5_path: mt5Path.trim() || null,
    })
    setSaving(false)
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-sm">Editando — {account.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Apelido</label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">
            Caminho do terminal64.exe
          </label>
          <Input
            value={mt5Path}
            onChange={(e) => setMt5Path(e.target.value)}
            placeholder="C:\\Program Files\\..."
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Corretora ({account.broker}) e tipo ({account.account_type}) não podem
          ser alterados — pra trocar, exclua e crie de novo. Token também não muda
          aqui (use &quot;Novo .zip&quot;).
        </p>
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

function AddAccountForm({
  existing,
  onCancel,
  onCreated,
  onError,
}: {
  existing: AccountRow[]
  onCancel: () => void
  onCreated: (secret: RevealedSecret, account: AccountRow) => void
  onError: (msg: string) => void
}) {
  const [label, setLabel] = useState("")
  const [broker, setBroker] = useState<AccountBroker>("xp")
  const [accountType, setAccountType] = useState<AccountType>("real")
  const [mt5Path, setMt5Path] = useState(BROKERS[0].defaultPath ?? "")
  const [saving, setSaving] = useState(false)

  function pickBroker(next: AccountBroker) {
    setBroker(next)
    const def = BROKERS.find((b) => b.id === next)?.defaultPath ?? ""
    setMt5Path(def)
  }

  const duplicate = existing.some(
    (a) => a.broker === broker && a.account_type === accountType
  )

  async function submit() {
    if (!label.trim() || duplicate) return
    setSaving(true)
    onError("")
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        broker,
        account_type: accountType,
        mt5_path: mt5Path.trim() || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) {
      onError(data.error ?? "Erro ao criar conta")
      return
    }
    onCreated(
      {
        accountId: data.account.id,
        label: data.account.label,
        token: data.token,
        package: data.package,
      },
      data.account
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Nova conta MT5</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Apelido</label>
          <Input
            placeholder="Ex: XP Real, Hantec Demo"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Corretora</label>
            <Select value={broker} onChange={(e) => pickBroker(e.target.value as AccountBroker)}>
              {BROKERS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)}>
              <option value="real">Real</option>
              <option value="demo">Demo</option>
            </Select>
          </div>
        </div>
        {duplicate && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Você já tem uma conta {accountType} dessa corretora cadastrada.
          </p>
        )}
        <div>
          <label className="text-xs text-muted-foreground">
            Caminho do terminal64.exe (default por corretora)
          </label>
          <Input
            placeholder="C:\\Program Files\\..."
            value={mt5Path}
            onChange={(e) => setMt5Path(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={submit} disabled={!label.trim() || saving || duplicate}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? "Criando..." : "Criar conta"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function RevealedSecretModal({
  secret,
  onClose,
}: {
  secret: RevealedSecret
  onClose: () => void
}) {
  function downloadPackage() {
    const bytes = Uint8Array.from(atob(secret.package.base64), (c) => c.charCodeAt(0))
    const blob = new Blob([bytes], { type: "application/zip" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = secret.package.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Token gerado — {secret.label}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Esse token só será exibido <strong>uma única vez</strong>. Baixe o
              pacote agora — ele já vem com o token embutido + agent Python +
              sources prontos pra rodar.
            </p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Token</p>
            <CopyableInline value={secret.token} />
          </div>

          <div>
            <Button onClick={downloadPackage} className="w-full">
              <Download className="h-4 w-4" />
              Baixar {secret.package.filename}
            </Button>
          </div>

          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs space-y-1">
            <p>
              <strong>Como rodar:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Extraia o <code>{secret.package.filename}</code> em qualquer pasta
                (ex: <code>C:\Pulse\</code>).
              </li>
              <li>
                <strong>Windows:</strong> duplo clique em{" "}
                <code>pulse-agent-start.bat</code> dentro da pasta extraída.
                <br />
                <strong>macOS:</strong>{" "}
                <code>chmod +x pulse-agent-start.command</code> e duplo clique.
                <br />
                <strong>Linux:</strong>{" "}
                <code>chmod +x pulse-agent-start.sh &amp;&amp; ./pulse-agent-start.sh</code>
              </li>
              <li>
                Faça login no MT5 dessa conta. O agent começa a empurrar candles
                automaticamente.
              </li>
            </ol>
            <p className="pt-1">
              Só a conta <strong>Ativa</strong> dispara regras — ativar Demo
              desativa Real e vice-versa.
            </p>
          </div>

          <Button onClick={onClose} variant="outline" className="w-full">
            Já copiei tudo, fechar
          </Button>
        </div>
      </div>
    </div>
  )
}

function CopyableInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="relative">
      <pre className="bg-secondary rounded-lg p-2.5 pr-12 text-xs font-mono overflow-x-auto whitespace-nowrap">
        {value}
      </pre>
      <button
        onClick={copy}
        className="absolute right-2 top-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] hover:bg-muted"
      >
        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  )
}
