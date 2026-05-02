-- Mutex de contas por corretora: real e demo podem coexistir cadastradas,
-- mas apenas uma fica ativa por (user_id, broker). O trigger garante a invariante
-- automaticamente quando o usuário liga uma — desliga a outra do mesmo broker.

-- Volta account_type a obrigatório (preenche null com 'real' por compatibilidade)
update accounts set account_type = 'real' where account_type is null;
alter table accounts alter column account_type set not null;
alter table accounts add constraint accounts_account_type_check
  check (account_type in ('real','demo'));

-- Mesmo broker não pode ter duas contas do mesmo tipo (XP-Real único, XP-Demo único)
alter table accounts add constraint accounts_unique_per_broker
  unique (user_id, broker, account_type);

-- Trigger: ao ativar uma conta, desativa as outras do mesmo broker
create or replace function ensure_single_active_account_per_broker()
returns trigger as $$
begin
  if new.active = true and (tg_op = 'INSERT' or old.active is distinct from new.active) then
    update accounts
    set active = false
    where user_id = new.user_id
      and broker = new.broker
      and id != new.id
      and active = true;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger accounts_single_active_per_broker
  before insert or update of active on accounts
  for each row
  execute function ensure_single_active_account_per_broker();

-- Default vira false: contas novas começam inativas, usuário ativa explicitamente
alter table accounts alter column active set default false;
