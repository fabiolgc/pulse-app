-- Alertas disparados quando uma regra é ativada
create table alerts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  rule_id      uuid not null references rules(id) on delete cascade,
  source       text not null references data_sources(id),
  symbol       text not null,
  price        numeric not null,
  message      text not null,
  direction    text,                       -- 'compra', 'venda', 'neutro'
  triggered_at timestamptz default now(),
  acknowledged boolean default false
);

create index idx_alerts_user on alerts (user_id, triggered_at desc);
create index idx_alerts_rule on alerts (rule_id);
