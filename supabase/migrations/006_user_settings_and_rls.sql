-- Configurações do usuário
create table user_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  telegram_chat_id text,
  telegram_enabled boolean default false,
  alert_sound      boolean default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Row Level Security
alter table rules            enable row level security;
alter table alerts           enable row level security;
alter table backtest_results enable row level security;
alter table user_settings    enable row level security;

create policy "users own rules"    on rules
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own alerts"   on alerts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own backtest" on backtest_results
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users own settings" on user_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- candles_history e data_sources são compartilhados (leitura pública, escrita via service role)
-- Não ativar RLS nessas tabelas pois o ingest usa service_role key
