"use client"

import { ChevronRight } from "lucide-react"
import { InfoTooltip } from "@/components/info-tooltip"
import type { RuleLogic } from "@/types"

function describeCondition(c: { indicator: string } & Record<string, unknown>): string {
  const ind = String(c.indicator ?? "").toLowerCase()
  const period = typeof c.period === "number" ? c.period : undefined
  const value = typeof c.value === "number" ? c.value : undefined
  const op = typeof c.operator === "string" ? c.operator : undefined
  const reference = typeof c.reference === "string" ? c.reference : undefined
  const refPeriod = typeof c.reference_period === "number" ? c.reference_period : undefined

  const opSymbol =
    op === "less_than" ? "<"
    : op === "greater_than" ? ">"
    : op === "equals" || op === "equal" ? "="
    : op === "cross_above" ? "cruza acima de"
    : op === "cross_below" ? "cruza abaixo de"
    : op

  const indLabel =
    ind === "close" ? "Preço"
    : ind === "open" ? "Abertura"
    : ind === "high" ? "Máxima"
    : ind === "low" ? "Mínima"
    : period
      ? `${ind.toUpperCase()}(${period})`
      : ind.toUpperCase()

  if (reference && opSymbol) {
    const refLabel = refPeriod
      ? `${reference.toUpperCase()}(${refPeriod})`
      : reference.toUpperCase()
    return `${indLabel} ${opSymbol} ${refLabel}`
  }
  if (value !== undefined && opSymbol) {
    return `${indLabel} ${opSymbol} ${value}`
  }
  return indLabel
}

export function RuleLogicSummary({ logic }: { logic: RuleLogic }) {
  const dirIcon = logic.signal === "compra" ? "▲" : logic.signal === "venda" ? "▼" : "•"
  const dirLabel = logic.signal === "compra" ? "Compra" : logic.signal === "venda" ? "Venda" : "Neutro"
  const dirColor =
    logic.signal === "compra" ? "text-emerald-500"
    : logic.signal === "venda" ? "text-destructive"
    : "text-muted-foreground"

  return (
    <div className="space-y-5 text-sm">
      <p className="leading-relaxed">
        Em <span className="font-mono">{logic.symbol}</span> no timeframe{" "}
        <span className="font-mono">{logic.timeframe}</span>, dispara{" "}
        <span className={`font-medium ${dirColor}`}>
          {dirIcon} alerta de {dirLabel.toLowerCase()}
        </span>{" "}
        quando:
      </p>

      {logic.conditions.length > 0 ? (
        <ul className="space-y-2">
          {logic.conditions.map((c, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <code className="font-mono text-xs px-2 py-1 rounded border border-border bg-muted/50">
                {describeCondition(c)}
              </code>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Sem condições — esta regra dispararia em todo candle. Edite para definir gatilhos.
        </p>
      )}

      {logic.filters.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Filtros adicionais</p>
          <ul className="space-y-2">
            {logic.filters.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" />
                <code className="font-mono text-xs px-2 py-1 rounded border border-border bg-muted/50">
                  {describeCondition(f)}
                </code>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-2 border-t border-border">
        <span className="font-mono tabular-nums text-xs inline-flex items-center gap-1.5">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            Stop
            <InfoTooltip
              ariaLabel="O que é stop"
              hint="Distância em pontos do preço de entrada até o stop loss. Define o risco máximo que a operação aceita."
            />
          </span>
          {logic.risk.stop_points} pts
        </span>
        <span className="font-mono tabular-nums text-xs inline-flex items-center gap-1.5">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            Alvo
            <InfoTooltip
              ariaLabel="O que é alvo"
              hint="Distância em pontos do preço de entrada até o take profit. Quando o preço chega aqui, a operação fecha em ganho."
            />
          </span>
          {logic.risk.gain_points} pts
        </span>
        <span className="font-mono tabular-nums text-xs inline-flex items-center gap-1.5">
          <span className="text-muted-foreground inline-flex items-center gap-1">
            R/R
            <InfoTooltip
              ariaLabel="O que é R/R"
              hint="Risk/Reward — relação entre alvo e stop. R/R 2:1 significa que cada operação vencedora ganha 2× o que uma perdedora arrisca. Win rate baixo pode dar lucro líquido se o R/R for alto."
            />
          </span>
          {logic.risk.ratio.toFixed(1)}:1
        </span>
      </div>

      <details className="group pt-1">
        <summary className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer select-none">
          <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
          Ver JSON gerado
        </summary>
        <pre className="mt-3 bg-secondary rounded-md p-3 text-[11px] font-mono overflow-x-auto text-muted-foreground">
          {JSON.stringify(logic, null, 2)}
        </pre>
      </details>
    </div>
  )
}
