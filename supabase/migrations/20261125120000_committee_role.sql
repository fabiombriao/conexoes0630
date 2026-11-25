-- Novo perfil "Comissão". Fica em arquivo próprio porque o Postgres não deixa
-- usar um valor de enum na mesma transação em que ele foi criado.
alter type public.app_role add value if not exists 'committee';
