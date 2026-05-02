import Anthropic from "@anthropic-ai/sdk"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const RULE_INTERPRETATION_PROMPT = `Você é um especialista em análise técnica de mercado financeiro brasileiro.
O usuário irá descrever uma regra de trading em português.
Sua tarefa é converter essa descrição em um JSON estruturado.

INDICADORES DISPONÍVEIS:
- rsi (period, operator: "less_than" | "greater_than" | "equals", value)
- ema (period, operator: "above_price" | "below_price")
- ema_cross (fast, slow, direction: "above" | "below")
- macd_cross_signal (direction: "above" | "below")
- bb_position (position: "above_upper" | "below_lower" | "inside")
- atr (period, operator: "less_than" | "greater_than", value)
- volume (operator: "above_avg" | "below_avg", multiplier)
- candle_pattern (pattern: "hammer" | "engulfing_bull" | "engulfing_bear" | "doji" | "marubozu_bull" | "marubozu_bear")

CONTEXTO B3:
- WINFUT (mini-índice): 1 ponto = R$0,20.
- WDOFUT (mini-dólar): 1 ponto = R$10,00.
Use valores realistas de stop/gain para esses contratos.

RESPONDA APENAS COM JSON VÁLIDO, sem explicações, sem markdown.

O JSON deve seguir este schema:
{
  "signal": "compra" | "venda",
  "conditions": [ { "indicator": "...", ...params } ],
  "filters": [],
  "risk": { "stop_points": number, "gain_points": number, "ratio": number },
  "timeframe": "M5" | "M15" | "M30" | "H1",
  "symbol": "WINFUT" | "WDOFUT"
}

Se o usuário não especificar stop/gain, use stop_points: 200, gain_points: 400, ratio: 2.0 como padrão.
Se o usuário não especificar símbolo, use "WINFUT".

ESCOLHA DE TIMEFRAME:
- Se o usuário **especificar** o timeframe, use esse valor.
- Se o usuário **não especificar** ou pedir explicitamente que você escolha, analise a estratégia descrita:
  - Scalping / entradas rápidas / múltiplos trades por dia → M1 ou M5
  - Swing curto / setups intradia / RSI + médias → M15 ou M30
  - Swing longo / tendência / médias longas (EMA200) → H1
  - Quando incerto, prefira M15 (bom equilíbrio sinal/ruído).
- Se o contexto trouxer "Timeframes disponíveis: [...]", **escolha apenas dentre esses** — outros TFs não terão candles ingestados.` as const

const SIGNAL_ANALYSIS_PROMPT = `Você é um analista de minicontratos brasileiros (WIN/WDO).
Analise os dados e verifique se as regras ativas foram disparadas.

Para cada regra, responda em JSON array:
[{
  "rule_id": "...",
  "triggered": true | false,
  "direction": "compra" | "venda" | "neutro",
  "confidence": 0-100,
  "reason": "explicação em 1 frase"
}]

RESPONDA APENAS COM JSON VÁLIDO.` as const

export interface InterpretRuleParams {
  description: string
  symbol?: string
  timeframe?: string
  availableTimeframes?: string[]
}

export async function interpretRule({
  description,
  symbol,
  timeframe,
  availableTimeframes,
}: InterpretRuleParams) {
  const userMessage = [
    description,
    symbol ? `Símbolo: ${symbol}` : "",
    timeframe ? `Timeframe: ${timeframe}` : "",
    !timeframe && availableTimeframes && availableTimeframes.length > 0
      ? `Timeframes disponíveis (escolha um): ${availableTimeframes.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: RULE_INTERPRETATION_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  return JSON.parse(stripJsonFence(text))
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fenceMatch ? fenceMatch[1].trim() : trimmed
}

export interface AnalyzeSignalsParams {
  rulesJson: string
  symbol: string
  price: number
  indicatorsJson: string
  patternsJson: string
}

export async function analyzeSignals({
  rulesJson,
  symbol,
  price,
  indicatorsJson,
  patternsJson,
}: AnalyzeSignalsParams) {
  const userMessage = `REGRAS ATIVAS: ${rulesJson}

DADOS ATUAIS:
- Símbolo: ${symbol}
- Preço: ${price}
- Indicadores: ${indicatorsJson}
- Padrões detectados: ${patternsJson}`

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SIGNAL_ANALYSIS_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  return JSON.parse(stripJsonFence(text))
}
