import { Activity, Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function SettingsPage() {
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
            <a href="/rules" className="text-muted-foreground hover:text-foreground">Regras</a>
            <a href="/backtest" className="text-muted-foreground hover:text-foreground">Backtest</a>
            <a href="/settings" className="font-medium text-foreground">Settings</a>
          </nav>
        </div>
      </header>

      <main className="p-6 max-w-2xl space-y-6">
        <h2 className="text-lg font-semibold">Configuracoes</h2>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Telegram</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure seu Telegram Chat ID para receber alertas no celular.
              Implementacao completa requer autenticacao.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fontes de Dados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gerencie as fontes de dados conectadas (MT5, Cedro, Nelogica).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sons de Alerta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configuracoes de som para alertas no browser.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
