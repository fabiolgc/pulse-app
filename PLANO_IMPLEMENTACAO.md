# MT5 + Claude — Plano Completo do Projeto

> Criado em: abril de 2026
> Objetivo: Sistema de sinais de trading para WIN/WDO usando MetaTrader 5 + Claude AI + Next.js + Supabase

---

## Visão Geral da Arquitetura

```
MetaTrader 5 (Windows)
    ↓ MetaTrader5 Python lib
Python Bridge (mt5_server.py)
    ↓ REST :5000  +  WebSocket :5001
Next.js App (frontend + API routes)
    ↔ Claude API (Anthropic)   — interpreta regras, gera sinais
    ↔ Supabase                 — regras, histórico, alertas, backtest
```

### Fluxo de trabalho

1. **Criar regra** — usuário escreve em português no editor
2. **Claude traduz** — converte linguagem natural em JSON estruturado de condições
3. **Backtest** — roda a regra sobre dados históricos salvos no Supabase
4. **Validar** — analisa win rate, drawdown, profit factor
5. **Monitorar ao vivo** — dashboard recebe dados RT do MT5 e dispara alertas visuais

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend + API | Next.js 14 (App Router) + TypeScript |
| Estilo | Tailwind CSS + shadcn/ui |
| Banco de dados | Supabase (PostgreSQL + Realtime) |
| IA | Anthropic Claude API (claude-sonnet-4-20250514) |
| Dados de mercado | MetaTrader 5 via Python bridge (mt5_server.py) |
| Gráficos | Lightweight Charts (TradingView) ou Recharts |

---

## Pré-requisitos

### Contas e credenciais necessárias

- [ ] **Supabase**: URL do projeto + `anon key` + `service_role key` → Settings → API
- [ ] **Anthropic**: API key → console.anthropic.com
- [ ] **MetaTrader 5**: login + senha + servidor da corretora (ex: `Rico-Demo`, `Clear-Real`)
- [ ] **Node.js 20+** instalado (Windows obrigatório para MT5)
- [ ] **Python 3.10+** instalado

### Dependências Python

```bash
pip install MetaTrader5 flask flask-cors websockets numpy pandas
```

### Claude Code (terminal)

```bash
npm install -g @anthropic/claude-code
claude
```

---

## Schema do Banco de Dados (Supabase)

### Tabela `rules`
```sql
create table rules (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null,           -- texto original em português
  logic_json  jsonb not null,          -- condições estruturadas
  symbol      text not null,           -- ex: WINFUT, WDOFUT
  tf          text not null default 'M5',
  active      boolean default false,
  created_at  timestamptz default now()
);
```

### Tabela `alerts`
```sql
create table alerts (
  id            uuid primary key default gen_random_uuid(),
  rule_id       uuid references rules(id),
  symbol        text not null,
  price         numeric not null,
  message       text not null,
  direction     text,                  -- 'compra', 'venda', 'neutro'
  triggered_at  timestamptz default now(),
  acknowledged  boolean default false
);
```

### Tabela `candles_history`
```sql
create table candles_history (
  id      bigserial primary key,
  symbol  text not null,
  tf      text not null,
  time    bigint not null,
  open    numeric not null,
  high    numeric not null,
  low     numeric not null,
  close   numeric not null,
  volume  bigint not null,
  unique(symbol, tf, time)
);
```

### Tabela `backtest_results`
```sql
create table backtest_results (
  id           uuid primary key default gen_random_uuid(),
  rule_id      uuid references rules(id),
  symbol       text not null,
  tf           text not null,
  start_date   date not null,
  end_date     date not null,
  metrics_json jsonb not null,         -- win_rate, drawdown, profit_factor, trades[]
  created_at   timestamptz default now()
);
```

---

## Estrutura de Pastas do Projeto

```
mt5-signals/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        ← redirect para /dashboard
│   ├── dashboard/
│   │   └── page.tsx                    ← preços RT + alertas visuais
│   ├── rules/
│   │   ├── page.tsx                    ← lista de regras
│   │   └── new/page.tsx                ← editor de regra
│   ├── backtest/
│   │   └── page.tsx                    ← rodar e ver resultados
│   └── api/
│       ├── analyze-rule/route.ts       ← Claude interpreta regra
│       ├── run-backtest/route.ts       ← executa backtest
│       ├── check-signals/route.ts      ← avalia regras nos dados RT
│       └── sync-candles/route.ts       ← salva candles no Supabase
├── components/
│   ├── CandleChart.tsx                 ← gráfico OHLCV em tempo real
│   ├── IndicatorsPanel.tsx             ← RSI, MACD, EMAs, BB, ATR
│   ├── PatternList.tsx                 ← padrões de candle detectados
│   ├── RuleEditor.tsx                  ← editor linguagem natural
│   ├── RuleCard.tsx                    ← card de regra com status
│   ├── AlertsPanel.tsx                 ← lista de alertas recentes
│   ├── BacktestReport.tsx              ← métricas e lista de trades
│   └── PriceTicket.tsx                 ← card BID/ASK/LAST piscante
├── lib/
│   ├── supabase.ts                     ← client Supabase
│   ├── supabase-server.ts              ← server-side client
│   ├── mt5-client.ts                   ← REST + WebSocket bridge
│   ├── rule-engine.ts                  ← avalia condições JSON vs indicadores
│   └── indicators.ts                   ← EMA, RSI, MACD, BB, ATR em TypeScript
├── hooks/
│   ├── useMarketData.ts                ← WebSocket com reconnect
│   ├── useAlerts.ts                    ← Supabase Realtime para alertas
│   └── useRules.ts                     ← CRUD de regras
├── types/
│   └── index.ts                        ← Rule, Alert, Candle, Indicator, etc.
├── supabase/
│   └── migrations/
│       ├── 001_rules.sql
│       ├── 002_alerts.sql
│       ├── 003_candles_history.sql
│       └── 004_backtest_results.sql
├── mt5_server.py                       ← backend Python (já implementado)
├── .env.local                          ← variáveis de ambiente
└── README.md
```

---

## Variáveis de Ambiente (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# MT5 Bridge (Python local)
MT5_BRIDGE_URL=http://localhost:5000
MT5_WS_URL=ws://localhost:5001
```

---

## Schema JSON de uma Regra

Quando o usuário escreve em linguagem natural, o Claude converte para este JSON:

### Exemplo de entrada (linguagem natural)
```
"Compra quando RSI 14 abaixo de 30 e EMA9 cruzar acima da EMA21,
no timeframe M5. Stop de 200 pontos e gain de 400 pontos."
```

### JSON gerado pelo Claude
```json
{
  "signal": "compra",
  "conditions": [
    {
      "indicator": "rsi",
      "period": 14,
      "operator": "less_than",
      "value": 30
    },
    {
      "indicator": "ema_cross",
      "fast": 9,
      "slow": 21,
      "direction": "above"
    }
  ],
  "filters": [],
  "risk": {
    "stop_points": 200,
    "gain_points": 400,
    "ratio": 2.0
  },
  "timeframe": "M5",
  "symbol": "WINFUT"
}
```

### Operadores suportados
- `less_than`, `greater_than`, `equals`
- `ema_cross` (cruzamento de médias)
- `price_above_bb`, `price_below_bb` (Bollinger)
- `macd_cross_signal` (MACD cruzando sinal)
- `candle_pattern` (ex: engolfo, martelo, doji)
- `volume_above_avg` (volume acima da média)

---

## Prompt do Claude para Interpretar Regras

```
Você é um especialista em análise técnica de mercado financeiro brasileiro.
O usuário irá descrever uma regra de trading em português.
Sua tarefa é converter essa descrição em um JSON estruturado.

INDICADORES DISPONÍVEIS:
- rsi (period, operator, value)
- ema (period, operator: "above_price" | "below_price")
- ema_cross (fast, slow, direction: "above" | "below")
- macd_cross_signal (direction: "above" | "below")
- bb_position (position: "above_upper" | "below_lower" | "inside")
- atr (period, operator, value)
- volume (operator: "above_avg" | "below_avg", multiplier)
- candle_pattern (pattern: "hammer" | "engulfing_bull" | "engulfing_bear" | "doji" | "marubozu_bull" | "marubozu_bear")

RESPONDA APENAS COM JSON VÁLIDO, sem explicações, sem markdown.
O JSON deve seguir exatamente o schema de Rule definido no sistema.
```

---

## Prompt do Claude para Análise de Sinais (Dashboard)

```
Você é um analista de minicontratos brasileiros (WIN/WDO).
Analise os dados e verifique se as regras ativas foram disparadas.

REGRAS ATIVAS: {rules_json}

DADOS ATUAIS:
- Símbolo: {symbol}
- Preço: {price}
- Indicadores: {indicators_json}
- Padrões detectados: {patterns_json}

Para cada regra, responda em JSON:
{
  "rule_id": "...",
  "triggered": true | false,
  "direction": "compra" | "venda" | "neutro",
  "confidence": 0-100,
  "reason": "explicação em 1 frase"
}
```

---

## Sequência de Prompts no Claude Code

Execute na ordem abaixo:

### Passo 1 — Setup inicial
```
Inicializa o projeto Next.js 14 com TypeScript e App Router.
Instala: tailwindcss, shadcn/ui, @supabase/supabase-js, @supabase/ssr.
Cria o arquivo .env.local com as variáveis definidas.
Configura o Supabase client em lib/supabase.ts e lib/supabase-server.ts.
```

### Passo 2 — Banco de dados
```
Cria as migrations SQL em supabase/migrations/ para as 4 tabelas:
rules, alerts, candles_history e backtest_results.
Inclui os índices necessários para queries por symbol+tf+time.
Cria os tipos TypeScript correspondentes em types/index.ts.
```

### Passo 3 — Bridge MT5
```
Cria lib/mt5-client.ts com:
- fetchSnapshot(symbol, tf): chama GET /snapshot/{symbol}
- fetchCandles(symbol, tf, n): chama GET /candles/{symbol}
- createWebSocketConnection(symbols, onMessage): conecta em ws://localhost:5001
- fallback automático para modo demo se o servidor não responder
```

### Passo 4 — Motor de regras
```
Cria lib/rule-engine.ts com a função evaluateRule(rule: Rule, indicators: Indicators): boolean.
Suporta todos os operadores do schema JSON de regras.
Cria lib/indicators.ts com EMA, RSI, MACD, Bollinger Bands e ATR em TypeScript puro.
```

### Passo 5 — API routes
```
Cria app/api/analyze-rule/route.ts:
  POST recebe {description, symbol, tf}
  Chama Claude API com o prompt de interpretação de regras
  Retorna o JSON estruturado da regra

Cria app/api/check-signals/route.ts:
  POST recebe {symbol, indicators, patterns}
  Busca regras ativas do Supabase
  Avalia cada regra com rule-engine.ts
  Salva alertas disparados no Supabase
  Retorna lista de sinais ativos
```

### Passo 6 — Página de Regras
```
Cria app/rules/page.tsx com lista de regras do Supabase.
Cria app/rules/new/page.tsx com:
  - Textarea para descrição em linguagem natural
  - Botão "Interpretar com Claude" que chama /api/analyze-rule
  - Preview do JSON gerado
  - Campos para nome, símbolo, timeframe
  - Botão salvar no Supabase
```

### Passo 7 — Dashboard ao vivo
```
Cria app/dashboard/page.tsx com:
  - Hook useMarketData que conecta via WebSocket
  - PriceTicket para WINFUT e WDOFUT com flash de cor
  - CandleChart com últimos 60 candles
  - IndicatorsPanel com RSI, MACD, EMAs, BB
  - AlertsPanel com alertas em tempo real via Supabase Realtime
  - Badge piscante quando regra dispara
  - Som de alerta (Web Audio API) configurável
```

### Passo 8 — Backtest
```
Cria app/backtest/page.tsx com:
  - Seletor de regra, símbolo, período e timeframe
  - Botão executar que chama /api/run-backtest
  - BacktestReport com: win rate, profit factor, max drawdown, total trades
  - Tabela de trades simulados (entrada, saída, resultado)
  - Gráfico de equity curve
```

---

## Como Rodar o Projeto

### 1. Iniciar a bridge Python (Windows com MT5)
```bash
python mt5_server.py
# Saída esperada:
# ✅ MT5 conectado
# 🟢 WebSocket em ws://localhost:5001
# 🟢 REST API em http://localhost:5000
```

### 2. Iniciar o Next.js
```bash
npm run dev
# App em http://localhost:3000
```

### 3. Fluxo de uso
1. Acesse `/rules/new` → escreva uma regra em português → salve
2. Acesse `/backtest` → selecione a regra → execute → analise
3. Acesse `/dashboard` → ative a regra → monitore alertas ao vivo

---

## Segurança

- **Nunca** commitar o `.env.local` no Git (já está no `.gitignore`)
- Use **conta DEMO** do MT5 para testes — nunca conecte conta real em desenvolvimento
- A bridge Python roda apenas em `localhost` — nunca expor na rede
- Credenciais MT5 ficam apenas no `mt5_server.py` local, nunca no banco ou frontend

---

## Próximos Passos (v2)

- [ ] Integração com Telegram para alertas mobile
- [ ] Suporte a múltiplos símbolos simultâneos
- [ ] Editor visual de regras (drag & drop de condições)
- [ ] Otimizador de parâmetros via backtest em grid
- [ ] Relatório PDF exportável de backtest
- [ ] Autenticação de usuários (Supabase Auth)
