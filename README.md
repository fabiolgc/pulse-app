# pulse

Monitor de sinais de trading para mercado B3 (WIN, WDO, IND, DOL).
Regras em linguagem natural interpretadas por Claude AI, backtest em dados históricos e alertas em tempo real no dashboard + Telegram + PWA mobile.

## Arquitetura

```
MetaTrader 5 / Cedro / Nelógica [futuro]
   ↓
Agente local (Python)  ──► WebSocket outbound ──►  Next.js (Vercel)
                                                       │
                                                       ↔ Claude API
                                                       ↔ Supabase (Postgres + Realtime + Auth)
                                                       ↔ Telegram Bot
```

Detalhes completos em [`PLANO_ARQUITETURA.md`](./PLANO_ARQUITETURA.md).

## Estrutura

```
pulse-app/
├── apps/
│   ├── web/        Next.js 14 (deploy Vercel)
│   └── agent/      Agente Python (roda no seu PC com MT5)
├── supabase/
│   └── migrations/ Schema + RLS
└── PLANO_ARQUITETURA.md
```

## Pré-requisitos

- Node.js 20+, pnpm 10+
- Python 3.10+
- MetaTrader 5 (Windows) com conta demo
- Conta Supabase (free tier OK)
- Chave Anthropic API

## Setup (WIP)

Ver sequência de 15 passos em `PLANO_ARQUITETURA.md`.
