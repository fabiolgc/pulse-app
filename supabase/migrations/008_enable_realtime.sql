-- Habilita Supabase Realtime nas tabelas que o front escuta
alter publication supabase_realtime add table candles_history;
alter publication supabase_realtime add table alerts;
alter publication supabase_realtime add table rules;
