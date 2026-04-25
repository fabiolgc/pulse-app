-- Catálogo de fontes de dados habilitadas
create table data_sources (
  id         text primary key,            -- 'mt5', 'cedro', 'nelogica', 'synthetic'
  label      text not null,               -- 'MetaTrader 5'
  enabled    boolean default true,
  token_hash text,                        -- bcrypt hash do token de ingest
  last_seen  timestamptz,
  created_at timestamptz default now()
);

-- Seed inicial
insert into data_sources (id, label) values
  ('mt5', 'MetaTrader 5'),
  ('synthetic', 'Dados Sintéticos');
