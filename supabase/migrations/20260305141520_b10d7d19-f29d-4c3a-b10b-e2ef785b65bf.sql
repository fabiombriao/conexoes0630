-- Permitir que usuários autenticados vejam todos os perfis ativos na tela de membros
DROP POLICY IF EXISTS "Authenticated users can read active profiles" ON public.profiles;

CREATE POLICY "Authenticated users can read active profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (status = 'active');