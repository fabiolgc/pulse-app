-- Regras de trading definidas pelo usuário
create table rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text not null,               -- texto original em português
  logic_json  jsonb not null,              -- condições estruturadas pelo Claude
  symbol      text not null,               -- ex: WINFUT, WDOFUT
  tf          text not null default 'M5',
  source_pref text references data_sources(id), -- opcional: fixar fonte preferida
  active      boolean default false,
  created_at  timestamptz default now()
);

create index idx_rules_user on rules (user_id);
create index idx_rules_active on rules (active) where active = true;
