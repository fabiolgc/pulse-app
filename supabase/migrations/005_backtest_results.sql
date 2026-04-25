-- Resultados de backtests executados
create table backtest_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  rule_id      uuid not null references rules(id) on delete cascade,
  source       text not null references data_sources(id),
  symbol       text not null,
  tf           text not null,
  start_date   date not null,
  end_date     date not null,
  metrics_json jsonb not null,             -- win_rate, drawdown, profit_factor, trades[]
  created_at   timestamptz default now()
);

create index idx_backtest_user on backtest_results (user_id, created_at desc);
