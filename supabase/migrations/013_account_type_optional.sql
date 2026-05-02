-- Pulse não precisa saber se a conta é real ou demo: o usuário escolhe ao logar
-- no MT5 e o agent acompanha qualquer um. Mantém a coluna pra histórico mas
-- relaxa NOT NULL e o check.

alter table accounts drop constraint if exists accounts_account_type_check;
alter table accounts alter column account_type drop not null;
