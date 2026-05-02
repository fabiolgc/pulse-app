import Link from "next/link"
import { ChevronRight, Server } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="px-6 py-6 max-w-3xl mx-auto">
        <header className="mb-8">
          <h2 className="text-2xl font-semibold tracking-tight">Configurações</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Contas MT5 e preferências da sua conta.
          </p>
        </header>

        <Link href="/settings/accounts" className="block">
          <Card className="hover:bg-muted/40 transition-colors">
            <CardContent className="py-4 flex items-center gap-3">
              <Server className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Contas MT5</p>
                <p className="text-xs text-muted-foreground">
                  Cadastre suas contas (XP, Hantec, demo) e baixe os scripts de
                  inicialização do agent.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </Link>
      </main>
    </div>
  )
}
