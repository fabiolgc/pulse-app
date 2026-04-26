import { Bell, TrendingUp, Activity } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

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
