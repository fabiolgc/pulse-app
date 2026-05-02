-- Símbolos e timeframes que o agent dessa conta deve assinar.
-- Default vazio: o front popula com sugestão por broker na criação.

alter table accounts add column symbols text[] not null default '{}';
alter table accounts add column timeframes text[] not null default '{M5,M15}';
