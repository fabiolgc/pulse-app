-- Engine: quem dispara o sinal (motor interno vs externo via webhook)
alter table rules add column engine text not null default 'pulse-native'
  check (engine in ('pulse-native','tradingview','nelogica','api','cedro'));

-- Artefatos específicos do engine TradingView
alter table rules add column pine_script text;
alter table rules add column webhook_token_hash text;
alter table rules add column last_webhook_at timestamptz;

-- TV não precisa de logic_json estruturado (a logic vive na TV)
alter table rules alter column logic_json drop not null;

-- Index para o motor pulse-native varrer só o que ele precisa avaliar
create index idx_rules_engine_active on rules (engine, symbol)
  where active = true;

-- Seed do source 'tradingview' pra satisfazer FK em alerts.source
insert into data_sources (id, label, enabled) values
  ('tradingview', 'TradingView', true)
  on conflict (id) do nothing;
