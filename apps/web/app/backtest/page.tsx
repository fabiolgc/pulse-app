import { BarChart3 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export default function BacktestPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

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
