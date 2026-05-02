"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Check, CheckCircle2, Circle, Loader2, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase"

type Status = {
  hasAccount: boolean
  hasActiveAccount: boolean
  agentOnline: boolean
  hasRule: boolean
  hasActiveRule: boolean
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000

export default function OnboardingPage() {
  const supabase = useMemo(() => createClient(), [])
  const [status, setStatus] = useState<Status | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const [accRes, ruleRes] = await Promise.all([
        supabase.from("accounts").select("id, active, last_seen"),
        supabase.from("rules").select("id, active"),
      ])

      if (!mounted) return

      const accs = accRes.data ?? []
      const rules = ruleRes.data ?? []
      const activeAcc = accs.find((a) => a.active === true) as
        | { last_seen: string | null }
        | undefined
      const agentOnline = !!(
        activeAcc?.last_seen &&
        Date.now() - new Date(activeAcc.last_seen).getTime() < STALE_THRESHOLD_MS
      )

      setStatus({
        hasAccount: accs.length > 0,
        hasActiveAccount: !!activeAcc,
        agentOnline,
        hasRule: rules.length > 0,
        hasActiveRule: rules.some((r) => r.active === true),
      })
    }
    load()
    return () => {
      mounted = false
    }
  }, [supabase])

  const steps = useMemo(() => {
    if (!status) return []
    return [
      {
        n: 1,
        title: "Cadastrar uma conta MT5",
        hint: "Crie sua conta XP ou Hantec no Pulse e baixe o script de inicialização do agent.",
        done: status.hasAccount,
        cta: { label: "Ir pra Contas", href: "/settings/accounts" },
      },
      {
        n: 2,
        title: "Ativar a conta (Real ou Demo)",
        hint: "Por corretora, só uma fica ativa. Ativar Demo desativa Real e vice-versa.",
        done: status.hasActiveAccount,
        cta: { label: "Gerenciar contas", href: "/settings/accounts" },
        blocked: !status.hasAccount,
      },
      {
        n: 3,
        title: "Rodar o agent local",
        hint: "Coloque o .bat baixado em uma pasta dedicada com agent.py + sources/, faça login no MT5 e execute. O agent vai começar a empurrar candles.",
        done: status.agentOnline,
        cta: { label: "Conferir status", href: "/settings/accounts" },
        blocked: !status.hasActiveAccount,
      },
      {
        n: 4,
        title: "Criar sua primeira regra",
        hint: "Descreva em PT-BR (ex: 'RSI 14 abaixo de 30 em WIN M5') e o Claude estrutura o JSON.",
        done: status.hasRule,
        cta: { label: "Nova regra", href: "/rules/new" },
        blocked: !status.hasAccount,
      },
      {
        n: 5,
        title: "Ativar a regra",
        hint: "Regras só disparam quando ativas E quando a conta delas está ativa.",
        done: status.hasActiveRule,
        cta: { label: "Ver regras", href: "/rules" },
        blocked: !status.hasRule,
      },
    ]
  }, [status])

  const allDone = status && steps.every((s) => s.done)
  const completed = steps.filter((s) => s.done).length

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold">Onboarding</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Checklist pra colocar o Pulse pra funcionar de ponta a ponta.
          </p>
        </div>

        {!status ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className={allDone ? "border-emerald-500/40" : undefined}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {allDone ? "Pronto pra rodar." : `${completed} de ${steps.length} passos concluídos`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {allDone
                      ? "Conta ativa, agent online, regra ativa. Acompanhe os monitores no dashboard."
                      : "Siga as etapas abaixo na ordem. Cada uma habilita a próxima."}
                  </p>
                </div>
                {allDone && (
                  <Link href="/dashboard">
                    <Button size="sm">
                      <ArrowRight className="h-4 w-4" />
                      Ir pro dashboard
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>

            <div className="space-y-2">
              {steps.map((step) => (
                <Card
                  key={step.n}
                  className={
                    step.done
                      ? "border-emerald-500/40"
                      : step.blocked
                      ? "opacity-60"
                      : undefined
                  }
                >
                  <CardContent className="py-4 flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {step.done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {step.n}. {step.title}
                        </span>
                        {step.done && (
                          <Badge className="text-[10px] bg-emerald-500 text-white">
                            <Check className="h-3 w-3" /> Feito
                          </Badge>
                        )}
                        {step.blocked && !step.done && (
                          <Badge variant="secondary" className="text-[10px]">Aguardando passo anterior</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{step.hint}</p>
                    </div>
                    {!step.done && !step.blocked && (
                      <Link href={step.cta.href} className="shrink-0">
                        <Button size="sm" variant="outline">
                          {step.cta.label}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {status.hasAccount && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Atalhos</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Link href="/settings/accounts">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                      Adicionar outra conta
                    </Button>
                  </Link>
                  <Link href="/rules/new">
                    <Button size="sm" variant="outline">
                      <Plus className="h-4 w-4" />
                      Nova regra
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
