-- Multi-conta MT5: cada conta (XP real, Hantec real, Hantec demo, etc) é uma linha em `accounts`,
-- com seu próprio token de ingest. rules/alerts/candles_history ganham account_id (nullable durante a transição).

create table accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  label         text not null,
  broker        text not null,
  account_type  text not null check (account_type in ('real','demo')),
  mt5_path      text,
  token_hash    text not null unique,
  last_seen     timestamptz,
  active        boolean default true,
  created_at    timestamptz default now()
);

create index idx_accounts_user on accounts (user_id);
create index idx_accounts_token_hash on accounts (token_hash);

alter table accounts enable row level security;

create policy "users own accounts" on accounts
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- FKs novas. account_id nullable enquanto convivem agents legacy (INGEST_TOKENS env)
-- e agents novos (token-per-account). Fase E dropa nullable após migrar tudo.

alter table candles_history add column account_id uuid
  references accounts(id) on delete cascade;
alter table rules add column account_id uuid
  references accounts(id) on delete set null;
alter table alerts add column account_id uuid
  references accounts(id) on delete set null;

create index idx_candles_account on candles_history (account_id, symbol, tf, time);
create index idx_rules_account on rules (account_id) where account_id is not null;
create index idx_alerts_account on alerts (account_id) where account_id is not null;

alter publication supabase_realtime add table accounts;
