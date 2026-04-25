import { Activity, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function BacktestPage() {
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
            <a href="/backtest" className="font-medium text-foreground">Backtest</a>
            <a href="/settings" className="text-muted-foreground hover:text-foreground">Settings</a>
          </nav>
        </div>
      </header>

      <main className="p-6 space-y-6">
        <h2 className="text-lg font-semibold">Backtest</h2>

        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Selecione uma regra e um periodo para rodar o backtest.</p>
              <p className="text-xs mt-1">
                Requer regras criadas e dados historicos no banco.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
