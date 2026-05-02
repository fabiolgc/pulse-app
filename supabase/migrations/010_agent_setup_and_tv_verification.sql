-- SO do usuário: usado pra gerar o script de inicialização do agent (.bat / .sh)
alter table user_settings add column os text
  check (os in ('windows','mac','linux'));

-- Verificação de regra TradingView: timestamp do primeiro webhook recebido.
-- Antes desse marco, a UI sinaliza "aguardando primeiro alerta".
alter table rules add column first_webhook_at timestamptz;
