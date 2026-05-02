-- Cleanup pós multi-conta: remove regras e candles sem account_id (legados pré-012)
-- e dropa rules.source_pref que virou inútil agora que tudo passa por account.

delete from rules where account_id is null;
delete from candles_history where account_id is null;

alter table rules drop column source_pref;

-- Em accounts: account_id em rules vira NOT NULL
-- (não pode mais existir regra órfã)
alter table rules alter column account_id set not null;
