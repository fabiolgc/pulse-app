# Product

## Register

product

## Users

Traders pessoa-física que operam mini-contratos da B3 (mini-índice WIN, mini-dólar WDO) via MetaTrader 5 com corretoras como XP, Hantec, Clear. Perfil heterogêneo: alguns são day-traders ativos (10+ aberturas do app por dia, monitor de 24"+, conhecem RSI/MACD/divergências), outros são swing/posição que checam 1-2x ao dia. Todos já operam — Pulse não é onde aprendem a operar, é onde escalam suas regras.

O Pulse não opera ordens — apenas notifica via Telegram quando regras descritas em linguagem natural ("avise quando RSI < 30 em WINFUT M5") detectam o setup. O agent local roda no Windows ao lado do MT5 e empurra candles para o Supabase; a web mostra status, edita regras, e roda backtest contra histórico.

Audiência atual: o autor + traders B3 do círculo próximo. Não é SaaS público ainda. Multi-tenant existe (auth + RLS), mas onboarding e copy assumem alguém que já entende o domínio.

## Product Purpose

Eliminar o trabalho repetitivo de ficar olhando gráfico esperando setup. O trader descreve a regra uma vez em português, o Pulse interpreta para JSON, o motor avalia em cada novo candle, e o alerta cai no Telegram com preço e direção. Backtest no histórico ajuda a calibrar antes de ativar.

Sucesso = trader confia o suficiente para deixar 5+ regras ativas simultâneas e parar de monitorar manualmente. Métricas internas: regras ativas/usuário, alertas/dia, retenção semana 4, % de regras com backtest rodado antes de ativar.

## Brand Personality

**Direto · Pragmático · Sem firula.**

Tom de ferramenta de trabalho com identidade visual clara, mas que nunca compete com o conteúdo (gráfico, números, alerta). Voz objetiva — fala como trader fala entre traders, sem condescendência didática nem jargão decorativo. Linha estética: Raycast, Plausible, Linear. Confiança discreta, não barulhenta.

Microcopy: imperativos curtos ("Ativar", "Rodar backtest"), nunca CTA hype ("✨ Comece agora!"). Vazios e erros assumem que o leitor é inteligente. Sem emojis em UI.

## Anti-references

Todas as quatro armadilhas dominantes do mercado de trading foram explicitamente vetadas:

- **Fintech genérica** (XP, Itaú, Nubank Empresas): navy + dourado, ícones lineares finos, gradientes azuis em CTAs, "Olá, [Nome] 👋", fotos de stock de pessoas felizes. Pulse não é banco.
- **Crypto/terminal neon**: fundo preto puro, verde-matrix em P&L, gráficos com glow, tipografia mono em tudo, badges "🚀 +247%". Estética saturada e cafona.
- **SaaS shadcn default**: cinza neutro chroma 0, Geist Sans, cards idênticos em grid, hero-metric template, dark mode "porque tools são dark". Cara de template — é exatamente como Pulse parece hoje.
- **Plataforma de corretora antiga** (MetaTrader, Profit, Tryd, ProfitChart): janelas flutuantes encavaladas, brutalismo anos 2000, densidade sem hierarquia, ícones 16px coloridos demais. Pulse é a alternativa moderna a isso.

A direção escolhida emerge por exclusão: identidade tipográfica e cromática autoral, neutros tintados (não chroma 0), cor de marca saturada e não-óbvia (não navy, não verde-trading, não dourado), respiração entre seções.

## Design Principles

1. **Densidade respeitosa.** Trader abre o app 10x por dia. Informação primária disponível sem scroll, mas com hierarquia clara entre o que é decisão (resultado de backtest, status do agent) e o que é referência (lista, configuração). Nada de `max-w-5xl` em telas que pedem largura.

2. **Mostre, não conte.** O peak moment é o gráfico com o alerta marcado e o resultado do backtest. Tudo o que rouba pixel desses dois precisa justificar presença. JSON da regra, descrições verbosas e badges decorativas não justificam.

3. **Sem jargão por jargão, mas sem condescendência.** Métricas técnicas (Profit Factor, Max Drawdown, Sharpe) ficam visíveis com tooltip em hover — não escondidas, não traduzidas para "Lucro/Prejuízo" infantilizado. Trader que não conhece o termo aprende em 1 hover.

4. **Onboarding curto, ativação rápida.** Primeiro uso precisa entregar valor em <5 min: cadastrar conta MT5 → criar primeira regra em linguagem natural → ver primeiro alerta. Sem tour modal, sem 7 passos. Empty states fazem o trabalho de onboarding contextual.

5. **Identidade memorável sem ser barulhenta.** Pulse precisa ter cara própria — alguém que tira logo e nome ainda reconhece pela paleta + tipografia + voz. Mas a cara nunca compete com o gráfico nem alerta. Personalidade vive em escolhas estruturais (cor, fonte, ritmo, microcopy), não em decoração (gradientes, sombras, ilustrações).

## Accessibility & Inclusion

WCAG AA em contraste de texto e em estados primários (botões, inputs, badges de status). Navegação por teclado funcional nos fluxos críticos: criar regra, editar regra, rodar backtest. Sem investimento dedicado em screen-reader, ARIA avançado ou suporte a alto-contraste de SO. Reduced-motion respeitado quando animações forem adicionadas. Cores bull/bear nunca como único canal de informação — sempre acompanhadas de ícone, texto ou direção (▲/▼, "C"/"V").
