import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AppHeader } from "@/components/app-header"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

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
