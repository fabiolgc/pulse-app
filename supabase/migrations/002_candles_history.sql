-- Histórico de candles recebidos dos agentes
create table candles_history (
  id      bigserial primary key,
  source  text not null references data_sources(id),
  symbol  text not null,
  tf      text not null,
  time    bigint not null,                -- epoch ms UTC
  open    numeric not null,
  high    numeric not null,
  low     numeric not null,
  close   numeric not null,
  volume  bigint not null,
  unique(source, symbol, tf, time)
);

create index idx_candles_symbol_tf_time on candles_history (symbol, tf, time desc);
create index idx_candles_source on candles_history (source);
