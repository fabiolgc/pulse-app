-- Permissão de leitura pública para tabelas compartilhadas
-- (service_role bypassa RLS para o ingest; usuários autenticados precisam dessa policy
-- pois Supabase ativa RLS por default em todas as tabelas)
create policy "public read data_sources"
  on data_sources for select
  to anon, authenticated
  using (true);

create policy "public read candles_history"
  on candles_history for select
  to anon, authenticated
  using (true);
