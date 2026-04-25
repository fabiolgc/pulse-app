import { Activity, Bell, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Pulse</h1>
            <Badge variant="outline" className="text-xs">
              Beta
            </Badge>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <a href="/dashboard" className="font-medium text-foreground">
              Dashboard
            </a>
            <a href="/rules" className="text-muted-foreground hover:text-foreground">
              Regras
            </a>
            <a href="/backtest" className="text-muted-foreground hover:text-foreground">
              Backtest
            </a>
            <a href="/settings" className="text-muted-foreground hover:text-foreground">
              Settings
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="p-6 space-y-6">
        {/* Price tickets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                WINFUT
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-bull" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">128.350</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando conexao do agente...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                WDOFUT
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-bear" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono">5.152,50</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aguardando conexao do agente...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Regras Ativas
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Nenhuma regra ativa
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas Hoje
              </CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Nenhum alerta disparado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Grafico WINFUT — M5
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] flex items-center justify-center border border-dashed border-border rounded-lg">
              <p className="text-muted-foreground text-sm">
                Grafico sera exibido quando dados estiverem disponiveis
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alerts panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Alertas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nenhum alerta ainda. Crie e ative regras para comecar a receber sinais.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
