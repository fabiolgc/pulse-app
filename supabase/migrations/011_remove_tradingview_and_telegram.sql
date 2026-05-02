-- Reverte 009 + parte do 006: remove engine TradingView e Telegram do user_settings.
-- Pulse fica só com motor interno + dados MT5. user_settings.os fica (usado pelo bootstrap).

drop index if exists idx_rules_engine_active;

alter table rules drop column if exists engine;
alter table rules drop column if exists pine_script;
alter table rules drop column if exists webhook_token_hash;
alter table rules drop column if exists last_webhook_at;
alter table rules drop column if exists first_webhook_at;

alter table rules alter column logic_json set not null;

delete from data_sources where id = 'tradingview';

alter table user_settings drop column if exists telegram_chat_id;
alter table user_settings drop column if exists telegram_enabled;
