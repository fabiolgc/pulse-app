import { Activity, Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function RulesPage() {
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

      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Minhas Regras</h2>
          <a href="/rules/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </a>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">Nenhuma regra criada ainda.</p>
              <p className="text-xs mt-1">
                Crie sua primeira regra de trading usando linguagem natural.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
