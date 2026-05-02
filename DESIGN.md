# Design

Visual system do Pulse. Decisões cromáticas e tipográficas estão capturadas aqui — `globals.css` é a fonte canônica das variáveis, este arquivo explica o porquê.

## Strategy

**Color strategy: Restrained.** Uma cor de marca (violet) carrega ações primárias, foco, estado ativo e indicadores. Neutros tintados frios estruturam o resto. Bull/bear são semânticos e vivem fora da paleta de marca.

**Theme: dark canon.** Light existe para coerência mas dark é onde o Pulse vive. Cena: trader em sala fechada às 09h, monitor de 27" com cortina baixa, café pela frente. Light é fallback institucional, não a tela em que decisões são tomadas.

## Color tokens

Todos em OKLCH. Hue 285 (violet) é a espinha — neutros tintados a chroma 0.006–0.008 nessa direção. Bull/bear isolados em hue 150 / hue 25.

### Marca (constante em ambos themes)

| Papel | Token | Valor (dark) | Uso |
|---|---|---|---|
| Primary | `--primary` | `oklch(0.62 0.19 285)` | Botão default, CTA, logo, ring de foco, marker de entrada no chart, link |
| Primary FG | `--primary-foreground` | `oklch(0.985 0.005 285)` | Texto sobre `--primary` |
| Ring | `--ring` | `oklch(0.62 0.19 285)` | Foco visível em inputs e botões |

### Neutros tintados frios (dark)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `oklch(0.155 0.006 285)` | Fundo principal da página |
| `--foreground` | `oklch(0.975 0.003 285)` | Texto primário |
| `--card` | `oklch(0.195 0.007 285)` | Surface elevada (cards) |
| `--popover` | `oklch(0.21 0.008 285)` | Popover, dropdown — leve elevação extra |
| `--secondary` | `oklch(0.265 0.008 285)` | Botão secundário, JSON pre |
| `--muted` | `oklch(0.245 0.007 285)` | Surface muted |
| `--muted-foreground` | `oklch(0.7 0.014 285)` | Texto secundário, label, timestamp |
| `--accent` | `oklch(0.28 0.018 285)` | Hover state, tinta sutil violet |
| `--border` | `oklch(0.27 0.008 285)` | Bordas, divisores |
| `--input` | `oklch(0.27 0.008 285)` | Bordas de input |

### Semântico

| Token | Valor | Uso |
|---|---|---|
| `--destructive` | `oklch(0.6 0.22 25)` | Excluir, erro |
| `--destructive-foreground` | `oklch(0.985 0.003 25)` | Texto sobre destructive (era bug — antes era igual a destructive) |
| `--color-bull` | `oklch(0.72 0.19 150)` | Candle alta, trade compra ganho |
| `--color-bear` | `oklch(0.63 0.24 25)` | Candle baixa, trade venda ganho |
| `--color-bull-muted` | `oklch(0.72 0.19 150 / 0.15)` | Background ganho |
| `--color-bear-muted` | `oklch(0.63 0.24 25 / 0.15)` | Background perda |

Bull/bear nunca são canal único — sempre acompanhados de ícone, direção textual ("C"/"V") ou setas (▲/▼).

### Charts (data viz)

| Token | Valor | Uso |
|---|---|---|
| `--chart-1` | `oklch(0.62 0.19 285)` | Série primária (violet — marca) |
| `--chart-2` | `oklch(0.7 0.13 200)` | Série secundária (teal) |
| `--chart-3` | `oklch(0.74 0.16 75)` | Série terciária (mostarda) |
| `--chart-4` | `oklch(0.66 0.2 20)` | Série quaternária (coral, próximo bear) |
| `--chart-5` | `oklch(0.66 0.13 150)` | Série quinária (verde, próximo bull) |

## Typography

**Display/UI:** `Inter Tight` (Google Fonts, weights 400/500/600/700). Variable: `--font-pulse-sans`. Aliasada via `--font-sans` no Tailwind.

**Numbers/Mono:** `JetBrains Mono` (Google Fonts, weights 400/500). Variable: `--font-pulse-mono`. Aliasada via `--font-mono` no Tailwind.

### Regras de aplicação

- **Tudo que é número de mercado vai em `font-mono tabular-nums`**: preço, volume, timestamp, KPI value, valores de candle, resultado de trade. Tabular-nums garante alinhamento decimal em colunas.
- **UI text fica em Inter Tight**: títulos, labels, body, navegação, badges (exceto badges com números puros).
- **Hierarquia através de scale + weight**:
  - Hero number (KPI dominante): `text-3xl font-mono font-medium tracking-tight`
  - Page title (`h2`): `text-lg font-semibold` ou maior
  - Card title: `text-sm font-medium`
  - Section label (uppercase): `text-[11px] uppercase tracking-wider`
  - Body: `text-sm` ou `text-xs`
  - Metadata (timestamp, source): `text-[11px]` ou `text-xs` muted

### Bans tipográficos

- Sem Geist (era a fonte default — saída por ser AI-slop tell).
- Sem fontes mono em label, título ou body — mono é canal exclusivo de número.
- Sem badges em `text-[10px]` ou menor para info importante (legibilidade em monitor 4K).

## Layout

- `--radius`: `0.625rem`. Cards, inputs, botões. Variantes `sm`/`md`/`lg`/`xl` derivadas.
- Containers: `max-w-5xl` para forms, `max-w-7xl` ou full-bleed para dashboards/charts (não totalmente aplicado ainda — pendente de `/impeccable layout`).
- Spacing: variar entre seções; `space-y-6` no main padrão, mas hero/peak moments podem respirar mais.

## Motion

- Logo: `animate-ping` no halo do ícone Activity — único momento de movimento na header. Justifica o nome "Pulse" sem entrar em decoração.
- Loaders: `animate-spin` em Loader2 para estados de carregamento.
- Transitions: `transition-colors` em hover states (rows, links). Sem `transition-all` (banido — anima props de layout).
- Sem bounce, elastic, ou animação de propriedades de layout (CSS spec do impeccable).
- `prefers-reduced-motion: reduce` em `globals.css` zera animations, transitions e scroll-behavior — o pulse-animation do logo, animate-spin de loaders e fade do tooltip respeitam a preferência do SO.

## Components

Base: shadcn/ui customizada. Componentes em `apps/web/components/ui/`:
- `button.tsx` — variantes default/destructive/outline/secondary/ghost/link, tamanhos default/sm/lg/icon
- `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`

Componentes de domínio em `apps/web/components/`:
- `rule-logic-summary.tsx` — traduz `RuleLogic` (JSON de regra) em frase legível PT-BR + chips de condições + bloco de risco. JSON cru fica atrás de `<details>` colapsado. Usado em `/rules/new` (preview pós-interpretação) e `/rules/[id]` (visão e edit).
- `empty-state.tsx` — componente padronizado para empty states. Ícone em `bg-primary/10 text-primary` com `ring-1 ring-primary/15` + título + descrição + ação primária (Button) e secundária (link). Usado em `/dashboard`, `/rules`, `/rules/new` (sem accounts), `/backtest`.
- `info-tooltip.tsx` — tooltip CSS-only (group-hover + group-focus-within) para explicar jargão técnico. Renderiza como `<HelpCircle>` discreto após o label; popover em `bg-popover` com fade+slide. Usado em Win Rate, Profit Factor, Max Drawdown, Resultado líquido, Stop, Alvo, R/R.
- `error-state.tsx` — error state padronizado para falhas de carregamento. Ícone `AlertCircle` em `bg-destructive/10` + título + mensagem + botão "Tentar novamente" (retry). Distingue de inline `<p className="text-destructive">` (usado para action errors curtos). Cada surface separa `loadError` (fullscreen ErrorState com retry) de `actionError` (inline `<p>`).

Sistema de feedback (`apps/web/lib/toast.tsx`):
- `ToastProvider` no `layout.tsx` envolve toda a app. Hook `useToast()` expõe `success`/`error`/`info`. Toasts aparecem em `top-right` com slide-in da direita, auto-dismiss em 4s, botão X manual. Acessível com `aria-live="polite"`. Usado em todas as actions de mutation: criar/editar/ativar/desativar/excluir regra, rodar backtest. Mensagens são descritivas e contextuais (ex: "RSI Oversold ativada — vai disparar no próximo candle"), não genéricas ("Sucesso!").
- `rule-chart.tsx` — wrapper de lightweight-charts com markers semânticos.
- `app-header.tsx` — header com pulse-animation no logo + nav (hamburger em mobile) + status banner.
- `source-status-banner.tsx` — alerta amber persistente quando agent local sem heartbeat.
- `backtest-player.tsx` — replay visual de candles do backtest.

Classes utility importantes:
- `tabular-nums` em todo número
- `font-mono` em todo número
- `tracking-tight` em hero numbers e titles grandes
- `tracking-wider` em uppercase labels (text-[11px])

## Anti-patterns banidos no Pulse

Seguindo `PRODUCT.md` e shared design laws do impeccable:
- ❌ Gradientes em texto (`background-clip: text` com gradient)
- ❌ Side-stripe borders (`border-left/right` > 1px como accent)
- ❌ Hero-metric template (5 cards idênticos de KPI lado a lado) — em `/backtest` ainda existe, marcado para refator em `/impeccable layout`
- ❌ Glassmorphism decorativo
- ❌ Modais como primeira escolha — `confirm()` nativo de delete em rules/page.tsx ainda existe, marcado para `/impeccable polish`
- ❌ Em-dashes em copy (`—` é ok como caractere de display, mas não na escrita)
- ❌ Pure black/white em áreas grandes
- ❌ Geist Sans (era a fonte — substituída)

## Quando mexer neste arquivo

Mudou um token em `globals.css`? Atualize aqui.
Adicionou um componente novo de UI? Mencione aqui.
Mudou regra de aplicação tipográfica? Atualize a seção Typography.

Não documente decisões hipotéticas — DESIGN.md reflete o que está no código.
