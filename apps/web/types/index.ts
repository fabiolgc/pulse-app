// ---- Candle / Tick ----

export interface Candle {
  time: number       // epoch ms UTC
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Tick {
  bid: number
  ask: number
  last: number
  volume: number
}

// ---- Ingest envelope ----

export type IngestType = "tick" | "candle" | "heartbeat"
export type SourceId = "mt5" | "cedro" | "nelogica" | "synthetic"

export interface IngestEnvelope {
  v: 1
  source: SourceId
  type: IngestType
  symbol: string
  tf?: string           // obrigatório para candle
  ts: number            // epoch ms UTC
  data: Candle | Tick | Record<string, never>
}

// ---- Rule ----

export type Direction = "compra" | "venda" | "neutro"

export type IndicatorOperator =
  | "less_than"
  | "greater_than"
  | "equals"

export interface RuleCondition {
  indicator: string
  [key: string]: unknown
}

export interface RuleRisk {
  stop_points: number
  gain_points: number
  ratio: number
}

export interface RuleLogic {
  signal: Direction
  conditions: RuleCondition[]
  filters: RuleCondition[]
  risk: RuleRisk
  timeframe: string
  symbol: string
}

export type AccountBroker = "xp" | "hantec" | "other"
export type AccountType = "real" | "demo"

export interface Account {
  id: string
  userId: string
  label: string
  broker: AccountBroker
  accountType: AccountType
  mt5Path: string | null
  lastSeen: string | null
  active: boolean
  createdAt: string
}

export interface Rule {
  id: string
  userId: string
  name: string
  description: string
  logicJson: RuleLogic
  symbol: string
  tf: string
  accountId: string
  active: boolean
  createdAt: string
}

// ---- Alert ----

export interface Alert {
  id: string
  userId: string
  ruleId: string
  source: SourceId
  symbol: string
  price: number
  message: string
  direction: Direction | null
  triggeredAt: string
  acknowledged: boolean
}

// ---- Indicators ----

export interface Indicators {
  ema: Record<number, number>     // period -> value
  rsi: Record<number, number>
  macd: {
    macd: number
    signal: number
    histogram: number
  }
  bb: {
    upper: number
    middle: number
    lower: number
  }
  atr: Record<number, number>
}

// ---- Signal evaluation result ----

export interface SignalResult {
  ruleId: string
  triggered: boolean
  direction: Direction
  confidence: number
  reason: string
}

// ---- Backtest ----

export interface BacktestTrade {
  entryTime: number
  entryPrice: number
  exitTime: number
  exitPrice: number
  direction: Direction
  result: number        // pontos
  resultPercent: number
}

export interface BacktestMetrics {
  totalTrades: number
  winRate: number
  profitFactor: number
  maxDrawdown: number
  netResult: number
  trades: BacktestTrade[]
}

// ---- User Settings ----

export interface UserSettings {
  userId: string
  telegramChatId: string | null
  telegramEnabled: boolean
  alertSound: boolean
}

// ---- Data Source ----

export interface DataSource {
  id: SourceId
  label: string
  enabled: boolean
  lastSeen: string | null
}
