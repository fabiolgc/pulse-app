# Plano — Arquitetura do `pulse` (Monitor de Sinais B3)

## Context

O usuário tem um `PLANO_IMPLEMENTACAO.md` com a arquitetura inicial (Next.js local + Supabase + Python bridge) e questionou se Supabase fazia sentido num app local, ou se o melhor seria um app deployado em nuvem recebendo sinais do script local.

Decisões confirmadas pelo usuário:
- **Acesso mobile é requisito**: quer ver alertas fora do PC que roda a fonte de dados.
- **Notificações**: visual no dashboard + Windows/Telegram (MVP) + WhatsApp (futuro).
- **Latência**: opera em M5+, tolera 50–200ms de internet.
- **Fontes de dados pluggáveis**: MetaTrader 5 é a primeira, mas o design precisa acomodar Cedro, Nelógica (via SDK/DLL) e outros provedores B3 em tempo real.
- **Nome neutro**: projeto chamado `pulse` (curto, moderno, evoca ritmo/batimento do mercado — não amarrado a nenhuma fonte específica).
- **Setup**: pnpm como package manager, inicializar na pasta atual (`C:\Users\fabio\Documents\Claude Trading Metatrader`).

Isso elimina a opção 100% local (não atende mobile) e a opção híbrida (Next local + Supabase cloud — que tem custo de cloud sem o benefício mobile). **Arquitetura vencedora: app deployado na nuvem + agente(s) local(is) que empurram dados para um contrato de ingest único.**

O plano a seguir reescreve o `PLANO_IMPLEMENTACAO.md` nessa arquitetura, mantendo tudo que já estava bom (Claude para interpretar regras, schema de 4 tabelas, rule engine, backtest, dashboard).

---

## Arquitetura Recomendada

```
┌─ SEU PC (Windows) ─────────────────────────────────────────────────────┐
│                                                                        │
│   MetaTrader 5 ──► agent (fonte: mt5)                                  │
│   Cedro [futuro] ──► agent (fonte: cedro)                              │
│   Nelógica [futuro] ──► agent (fonte: nelogica)                        │
│                            │                                           │
│                            │  WebSocket cliente (outbound, token auth) │
│                            ▼                                           │
└────────────────────────────┼───────────────────────────────────────────┘
                             │  wss://pulse.vercel.app/api/ingest
                             ▼
┌─ NUVEM ────────────────────────────────────────────────────────────────┐
│                                                                        │
│   Next.js (Vercel)   ◄────────► Claude API                             │
│     │                                                                  │
│     ├── /api/ingest         (recebe candles/ticks de qualquer agente)  │
│     ├── /api/analyze-rule   (Claude interpreta regra em JSON)          │
│     ├── /api/check-signals  (avalia regras → grava alertas)            │
│     ├── /api/run-backtest   (roda backtest sobre candles_history)      │
│     ├── /api/telegram/send  (envia alerta via bot)                     │
│     └── UI (dashboard, regras, backtest, settings) — mobile-ready      │
│                                                                        │
│   Supabase (Postgres + Realtime + Auth)                                │
│     ├── rules, alerts, candles_history, backtest_results,              │
│     │   user_settings, data_sources                                    │
│     └── Realtime → UI recebe alertas push                              │
│                                                                        │
│   Telegram Bot (envia alertas no celular)                              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Decisões-chave

| Decisão | Escolha | Por quê |
|---|---|---|
| Nome | **pulse** | Curto, moderno, evoca ritmo/batimento do mercado. Neutro quanto à fonte. URL `pulse.vercel.app` (se disponível; senão `pulse-app.vercel.app`). |
| Hosting do app | **Vercel** | Next.js first-class, free tier cobre, edge functions úteis, zero-config |
| Banco | **Supabase cloud** | Realtime para alertas mobile/browser, Auth pronto, backup automático |
| Agente local | **Python + WebSocket client outbound** | Não expõe porta, não precisa ngrok/túnel, firewall amigável |
| Abstração de fonte | **Interface `MarketDataSource`** | MT5 v1, Cedro/Nelógica plugáveis sem tocar no server |
| Auth do agente | **Token estático por fonte em env var** | Single-user, simples; permite múltiplos agentes simultâneos |
| Auth da UI | **Supabase Auth (email mágico)** | Protege o dashboard na internet pública |
| Notificação mobile | **Telegram Bot (MVP) → WhatsApp (futuro)** | Telegram Bot API é trivial; WhatsApp via Meta Cloud API depois |
| ORM | **Drizzle** | Schema em TS, migrations legíveis, bom com Claude Code |
| Gráfico | **Lightweight Charts** | Profissional para OHLCV |
| Package manager | **pnpm** | Ideal para monorepo, mais rápido, usa menos disco |

---

## Fontes de Dados Pluggáveis

Requisito central: o agente local hoje lê do MT5, mas amanhã pode vir de Cedro, Nelógica ou outro feed B3. O design isola a fonte atrás de um contrato único.

### Contrato de Ingest (versionado)

Toda mensagem que chega em `/api/ingest` tem este formato, independentemente da origem:

```json
{
  "v": 1,
  "source": "mt5" | "cedro" | "nelogica" | "synthetic",
  "type": "tick" | "candle" | "heartbeat",
  "symbol": "WINFUT",
  "tf": "M5",                       // só para "candle"
  "ts": 1713801600000,              // epoch ms, UTC
  "data": {
    // para tick:   { bid, ask, last, volume }
    // para candle: { open, high, low, close, volume }
  }
}
```

O server não sabe (nem liga) para a fonte. Só valida o token, resolve qual `source_id` corresponde, grava com a coluna `source` preenchida e segue o fluxo.

### Interface `MarketDataSource` (no agente)

```python
class MarketDataSource(Protocol):
    name: str                                   # "mt5", "cedro", …
    def connect(self) -> None: ...              # login no fornecedor
    def subscribe(self, symbols, tfs) -> None: ...
    def iter_events(self) -> Iterator[Event]:  # yields ticks/candles padronizados
    def close(self) -> None: ...
```

Implementações:
- **v1 (MVP):** `MT5Source` usando `MetaTrader5` (pip).
- **v2:** `CedroSource` (WebSocket oficial do CedroCrystal).
- **v3:** `NelogicaSource` (via DLL/SDK da Nelógica; exige wrapper COM ou `pythonnet`).
- **dev:** `SyntheticSource` — gera dados falsos deterministas para testes e para rodar o dashboard sem mercado aberto.

Cada implementação fica em `apps/agent/sources/<name>.py`. O entry point `agent.py` escolhe por env var `SOURCE=mt5|cedro|nelogica|synthetic`.

### Rodar múltiplas fontes

Como o token de auth é por-fonte, você pode rodar dois agentes ao mesmo tempo (ex.: MT5 num PC, Cedro numa VM Linux) — ambos empurrando para o mesmo `/api/ingest`. O UI filtra/consolida pela coluna `source`.

---

## Diferenças vs `PLANO_IMPLEMENTACAO.md`

1. **Bridge Python é renomeada e repensada**: `mt5_server.py` (servidor REST+WS local) vira um agente genérico com implementação MT5 como uma de várias possíveis fontes. Não expõe porta.
2. **Fontes pluggáveis**: interface `MarketDataSource` + pasta `apps/agent/sources/`. Abre caminho para Cedro/Nelógica sem refactor.
3. **Variáveis de ambiente separadas**: cada agente tem `.env` próprio. App cloud tem as credenciais Supabase/Anthropic.
4. **Nova API route `/api/ingest`**: recebe candles/ticks via WebSocket (ou POST como fallback), validado por token + campo `source`.
5. **Auth adicionado**: Supabase Auth (email mágico) no app.
6. **Telegram adicionado**: tabela `user_settings` com `telegram_chat_id`.
7. **PWA manifest**: para instalar no celular e ganhar notificações.
8. **Schema**: `candles_history` e `alerts` ganham coluna `source` para rastrear origem.
9. **Tabela `data_sources`**: catálogo de fontes habilitadas com token hash e last_seen.

---

## Stack Final

**App cloud (deploy Vercel):**
- Next.js 14 (App Router) + TypeScript
- Tailwind + shadcn/ui
- Supabase JS + Supabase Auth
- Drizzle ORM (aponta para Supabase Postgres)
- Anthropic SDK (`@anthropic-ai/sdk`)
- `ws` (ingest Node runtime) ou HTTP streaming como fallback
- Lightweight Charts
- PWA via `next-pwa`

**Agente(s) local(is) — Python 3.10+:**
- `MetaTrader5` (apenas para `MT5Source`)
- `websockets` (cliente de ingest)
- `python-dotenv`
- `pythonnet` (futuro, para `NelogicaSource` via DLL)
- Estrutura modular: `sources/mt5.py`, `sources/cedro.py`, `sources/synthetic.py`

**Observabilidade mínima:**
- Logs do Vercel para o app
- Log local em arquivo rotativo no agente (`logs/agent.log`)

---

## Schema do Banco

Partindo do plano original, com ajustes para multi-fonte e multi-usuário:

```sql
-- Catálogo de fontes habilitadas
create table data_sources (
  id         text primary key,        -- 'mt5', 'cedro', 'nelogica', 'synthetic'
  label      text not null,           -- 'MetaTrader 5'
  enabled    boolean default true,
  last_seen  timestamptz,
  created_at timestamptz default now()
);

-- Candles com rastreamento de fonte
create table candles_history (
  id      bigserial primary key,
  source  text not null references data_sources(id),
  symbol  text not null,
  tf      text not null,
  time    bigint not null,
  open    numeric not null,
  high    numeric not null,
  low     numeric not null,
  close   numeric not null,
  volume  bigint not null,
  unique(source, symbol, tf, time)
);
create index idx_candles_symbol_tf_time on candles_history (symbol, tf, time desc);

-- Regras (por usuário)
create table rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id),
  name        text not null,
  description text not null,
  logic_json  jsonb not null,
  symbol      text not null,
  tf          text not null default 'M5',
  source_pref text,                   -- opcional: fixar fonte preferida; senão usa qualquer
  active      boolean default false,
  created_at  timestamptz default now()
);

-- Alertas disparados
create table alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id),
  rule_id      uuid references rules(id),
  source       text not null references data_sources(id),
  symbol       text not null,
  price        numeric not null,
  message      text not null,
  direction    text,                  -- 'compra', 'venda', 'neutro'
  triggered_at timestamptz default now(),
  acknowledged boolean default false
);

-- Resultados de backtest
create table backtest_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id),
  rule_id      uuid references rules(id),
  source       text not null references data_sources(id),
  symbol       text not null,
  tf           text not null,
  start_date   date not null,
  end_date     date not null,
  metrics_json jsonb not null,
  created_at   timestamptz default now()
);

-- Configurações do usuário
create table user_settings (
  user_id          uuid primary key references auth.users(id),
  telegram_chat_id text,
  telegram_enabled boolean default false,
  alert_sound      boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- RLS multi-tenant
alter table rules            enable row level security;
alter table alerts           enable row level security;
alter table backtest_results enable row level security;
alter table user_settings    enable row level security;

create policy "users own rules"    on rules            using (auth.uid() = user_id);
create policy "users own alerts"   on alerts           using (auth.uid() = user_id);
create policy "users own bt"       on backtest_results using (auth.uid() = user_id);
create policy "users own settings" on user_settings    using (auth.uid() = user_id);

-- candles_history e data_sources são compartilhados (sem RLS, read-only público via service role)
```

---

## Estrutura de Pastas

```
pulse/
├── apps/
│   ├── web/                              ← Next.js (deploy Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/login/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── rules/{page.tsx, new/page.tsx}
│   │   │   ├── backtest/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── api/
│   │   │       ├── ingest/route.ts
│   │   │       ├── analyze-rule/route.ts
│   │   │       ├── run-backtest/route.ts
│   │   │       ├── check-signals/route.ts
│   │   │       └── telegram/send/route.ts
│   │   ├── components/  (CandleChart, IndicatorsPanel, RuleEditor, AlertsPanel, SourceBadge, …)
│   │   ├── lib/         (supabase, rule-engine, indicators, claude, telegram, ingest-schema)
│   │   ├── hooks/       (useAlerts, useRules, useMarketData)
│   │   ├── db/          (schema.ts, migrations/)
│   │   ├── types/
│   │   └── public/      (manifest.json, icons PWA)
│   └── agent/                            ← Python (roda no seu PC)
│       ├── agent.py                      ← entry point: lê SOURCE env e inicia fonte certa
│       ├── ingest_client.py              ← WebSocket outbound + buffer + reconnect
│       ├── sources/
│       │   ├── __init__.py               ← interface MarketDataSource
│       │   ├── mt5.py                    ← MT5Source (MVP)
│       │   ├── synthetic.py              ← dados fake para dev/testes
│       │   ├── cedro.py                  ← placeholder com stub
│       │   └── nelogica.py               ← placeholder com stub
│       ├── indicators.py                 ← opcional: calcular local
│       ├── .env.example
│       └── requirements.txt
├── supabase/
│   └── migrations/
│       ├── 001_data_sources.sql
│       ├── 002_candles_history.sql
│       ├── 003_rules.sql
│       ├── 004_alerts.sql
│       ├── 005_backtest_results.sql
│       └── 006_user_settings_and_rls.sql
├── package.json                          ← workspace root (pnpm)
├── pnpm-workspace.yaml
├── .gitignore
└── README.md
```

---

## Variáveis de Ambiente

### `apps/web/.env.local` (Vercel env vars em produção)
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
INGEST_TOKENS={"mt5":"token-xxx","cedro":"token-yyy"}   # JSON: por fonte
TELEGRAM_BOT_TOKEN=...                                  # opcional no MVP
```

### `apps/agent/.env` (fica no seu PC, nunca no Git)
```env
SOURCE=mt5                                              # mt5 | cedro | nelogica | synthetic
INGEST_URL=wss://pulse.vercel.app/api/ingest
INGEST_TOKEN=token-xxx                                  # o token correspondente à SOURCE

# Específicos da fonte (só os necessários para a SOURCE escolhida):
MT5_LOGIN=...
MT5_PASSWORD=...
MT5_SERVER=Rico-Demo

# Assinatura
SYMBOLS=WINFUT,WDOFUT
TIMEFRAMES=M5,M15
```

---

## Fluxo de Dados Detalhado

### 1. Stream RT (agente → cloud)
```
agent.py loop:
  a. resolve source = MT5Source() (ou Cedro/Nelógica/Synthetic)
  b. source.connect(); source.subscribe(symbols, tfs)
  c. for event in source.iter_events():
       envelope = { v:1, source, type, symbol, tf, ts, data }
       ingest_client.send(envelope)
  d. se WS cair: reconecta com exponential backoff; buffer em memória (ring buffer 10k msgs)
```

### 2. Ingest → Supabase (cloud)
```
/api/ingest (WebSocket server):
  - valida Authorization: Bearer <token> contra INGEST_TOKENS
  - valida envelope.source == token.source
  - se candle: upsert em candles_history (chave source+symbol+tf+time)
  - se tick: broadcast via Supabase Realtime (canal `ticks:${source}:${symbol}`)
  - após cada candle: chama rule-engine → grava alertas para regras ativas daquele símbolo
  - atualiza data_sources.last_seen
```

### 3. Alerta → Notificação
```
Insert em alerts:
  - Supabase Realtime → UI (AlertsPanel piscando)
  - Trigger (Edge Function ou route handler): envia Telegram se user_settings.telegram_enabled
  - PWA instalada recebe push (service worker + Web Push)
```

### 4. Interpretar regra (UI → Claude)
```
Usuário escreve regra em PT → /api/analyze-rule → Claude retorna JSON →
preview no editor → salva rule no Supabase com user_id.
```

### 5. Backtest
```
Usuário seleciona regra + período + fonte → /api/run-backtest →
lê candles_history WHERE source=? → roda rule-engine candle a candle → calcula métricas →
grava em backtest_results → UI mostra relatório.
```

---

## Sequência de Implementação

Ordem otimizada para entregar valor rápido e iterar:

1. **Setup monorepo pnpm** (`apps/web`, `apps/agent`) + Next.js 14 + Tailwind + shadcn/ui. Repositório Git inicializado e subido ao GitHub.
2. **Projeto Supabase criado** + migrations 001–006 rodadas + seed de `data_sources` (mt5, synthetic).
3. **Drizzle schema + types** espelhando as tabelas.
4. **Auth básica** (login por email mágico) + página protegida `/dashboard` stub + deploy Vercel inicial.
5. **Agente: estrutura pluggável** (`agent.py`, `sources/__init__.py`, `sources/synthetic.py`). Loga eventos fake no console.
6. **`/api/ingest` (POST simples)**: valida token por-fonte, aceita batch de eventos, grava em `candles_history`.
7. **Agente → ingest via HTTP**: `SyntheticSource` empurra candles de teste de ponta a ponta. Validar.
8. **`MT5Source`**: implementação real do MetaTrader 5.
9. **Upgrade para WebSocket** no `/api/ingest` (quando HTTP estiver estável).
10. **`/api/analyze-rule`** + página `/rules/new` com Claude.
11. **Rule engine + `/api/check-signals`** disparado automaticamente após cada candle.
12. **Dashboard**: CandleChart + IndicatorsPanel + AlertsPanel com Supabase Realtime + SourceBadge.
13. **Telegram**: bot via @BotFather, endpoint que envia mensagem, settings page.
14. **Backtest**: página + `/api/run-backtest` + BacktestReport.
15. **PWA**: manifest + service worker + Web Push (notificação mobile sem depender só do Telegram).

Stubs de `CedroSource` e `NelogicaSource` ficam para pós-MVP — mas a interface e o contrato de ingest já estão prontos para recebê-los.

---

## Critical Files

### Novos (a criar)
- `apps/web/app/api/ingest/route.ts`
- `apps/web/app/api/analyze-rule/route.ts`
- `apps/web/app/api/check-signals/route.ts`
- `apps/web/app/api/run-backtest/route.ts`
- `apps/web/app/api/telegram/send/route.ts`
- `apps/web/lib/rule-engine.ts`
- `apps/web/lib/indicators.ts`
- `apps/web/lib/claude.ts`
- `apps/web/lib/telegram.ts`
- `apps/web/lib/ingest-schema.ts` — **contrato compartilhado** (fonte de verdade do envelope)
- `apps/web/db/schema.ts`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/app/rules/{page,new/page}.tsx`
- `apps/web/app/backtest/page.tsx`
- `apps/web/app/settings/page.tsx`
- `apps/agent/agent.py`
- `apps/agent/ingest_client.py`
- `apps/agent/sources/__init__.py` — interface `MarketDataSource`
- `apps/agent/sources/mt5.py`
- `apps/agent/sources/synthetic.py`
- `apps/agent/sources/cedro.py` (stub)
- `apps/agent/sources/nelogica.py` (stub)
- `apps/agent/requirements.txt`
- `supabase/migrations/00{1..6}_*.sql`
- `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`

### Já existentes
- `C:\Users\fabio\Documents\Claude Trading Metatrader\PLANO_IMPLEMENTACAO.md` — manter como referência histórica.

### A reutilizar do plano original
- Schema JSON de regra (seção "Schema JSON de uma Regra")
- Prompts para Claude (interpretar regra + analisar sinais)
- Lista de indicadores e operadores suportados

---

## Verificação (end-to-end)

1. **Agente sintético empurra dados**: `SOURCE=synthetic python agent.py` → ver linhas novas em `candles_history` com `source='synthetic'`.
2. **Agente MT5 conecta**: `SOURCE=mt5 python agent.py` no Windows → log `MT5 conectado — conta X, saldo Y`.
3. **Ingest rejeita token errado**: curl com token inválido retorna 401.
4. **Login no app cloud**: abrir `pulse.vercel.app`, login por email mágico, chegar em `/dashboard`.
5. **Dashboard mostra preço RT**: `PriceTicket` atualiza em 1–2s; `SourceBadge` exibe origem.
6. **Criar regra**: "Compra quando RSI 14 abaixo de 30 em M5" → Interpretar → ver JSON → salvar → ativar.
7. **Disparo de alerta**: forçar condição → aparece no `AlertsPanel` **e** Telegram **e** PWA.
8. **Backtest**: selecionar regra + fonte + 30 dias → ver win rate/drawdown/profit factor coerentes.
9. **Acesso mobile**: instalar PWA no celular, confirmar que alertas chegam com PC fora do browser.
10. **Resiliência**: desligar internet do PC do agente 2 min → reconecta e não perde candles (buffer).
11. **Swap de fonte**: parar agente MT5, subir `SOURCE=synthetic` no mesmo PC, UI continua funcionando.

---

## Próximos Passos (pós-MVP)

- Implementar `CedroSource` (contrato CedroCrystal + WebSocket)
- Implementar `NelogicaSource` via `pythonnet` + DLL Profit
- WhatsApp via Meta Cloud API
- Multi-símbolo dinâmico (adicionar/remover via UI sem reiniciar o agente)
- Otimizador de parâmetros (grid search sobre backtest)
- Modo "paper trading" (simula ordens sem enviar ao broker)
- Consolidação de fontes (se MT5 e Cedro derem dados do mesmo símbolo: regra de precedência)
- Se performance apertar: separar ingest em serviço próprio (Fly.io/Railway) mantendo Vercel só para UI/API
