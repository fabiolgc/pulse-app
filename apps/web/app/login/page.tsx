"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Activity, Mail, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase"

function LoginForm() {
  const params = useSearchParams()
  const next = params.get("next") ?? "/dashboard"
  const initialError = params.get("error") === "auth_failed" ? "Falha na autenticação. Tente novamente." : null

  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setSent(true)
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-base">Entrar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          <div className="space-y-2 text-sm">
            <p className="text-foreground">Link de acesso enviado para <strong>{email}</strong>.</p>
            <p className="text-muted-foreground text-xs">Abra o e-mail e clique no link para entrar. Pode levar até 1 minuto.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs text-muted-foreground">E-mail</label>
              <Input
                id="email"
                type="email"
                required
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading || !email.trim()} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {loading ? "Enviando..." : "Receber link de acesso"}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              Sem senha. Você recebe um link no e-mail e entra com um clique.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex h-6 w-6 items-center justify-center">
            <span className="absolute inset-1 rounded-full bg-primary/30 animate-ping" />
            <Activity className="relative h-5 w-5 text-primary" strokeWidth={2.5} />
          </span>
          <h1 className="text-lg font-semibold tracking-tight">Pulse</h1>
          <Badge
            variant="outline"
            className="text-[10px] uppercase tracking-wider font-medium"
          >
            Beta
          </Badge>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        <Suspense fallback={<Card className="w-full max-w-sm"><CardContent className="py-8 text-center text-muted-foreground text-sm">Carregando...</CardContent></Card>}>
          <LoginForm />
        </Suspense>
      </main>
    </div>
  )
}
