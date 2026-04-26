import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AppHeader } from "@/components/app-header"

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

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
