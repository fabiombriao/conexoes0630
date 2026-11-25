-- Comissão: continua membro e ganha acesso ao quadro de ideias.
--
-- 'committee' é uma linha ADICIONAL em user_roles (a linha 'member' continua),
-- então nenhuma permissão de membro muda. Só o Super Admin insere ou remove
-- linhas em user_roles (policy "Admins can manage roles", já existente).

-- Quem acessa o quadro de ideias: Super Admin, ou Comissão com cadastro ativo.
create or replace function public.can_access_ideas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role)
    or (
      public.has_role(auth.uid(), 'committee'::public.app_role)
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.status = 'active'
      )
    );
$$;

revoke all on function public.can_access_ideas() from public, anon;
grant execute on function public.can_access_ideas() to authenticated;

-- Possíveis responsáveis por ideias e tarefas. Necessário porque a Comissão não
-- enxerga as linhas de outras pessoas em user_roles.
create or replace function public.get_idea_team()
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct r.user_id
  from public.user_roles r
  where r.role in ('admin'::public.app_role, 'committee'::public.app_role)
    and public.can_access_ideas();
$$;

revoke all on function public.get_idea_team() from public, anon;
grant execute on function public.get_idea_team() to authenticated;

-- Tabelas do quadro
do $$
declare
  t text;
begin
  foreach t in array array[
    'idea_stages', 'idea_tags', 'ideas', 'idea_tag_links',
    'idea_tasks', 'idea_values', 'idea_notes', 'idea_attachments'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_superadmin_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_team_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using ((select public.can_access_ideas())) '
      || 'with check ((select public.can_access_ideas()))',
      t || '_team_all', t
    );
  end loop;
end $$;

drop policy if exists idea_history_superadmin_select on public.idea_history;
drop policy if exists idea_history_team_select on public.idea_history;
create policy idea_history_team_select on public.idea_history
for select to authenticated
using ((select public.can_access_ideas()));

-- RPCs de etapas
create or replace function public.reorder_idea_stages(_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_ideas() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.idea_stages s
  set position = o.ord::integer
  from unnest(_ids) with ordinality as o(id, ord)
  where s.id = o.id;
end;
$$;

create or replace function public.delete_idea_stage(_stage_id uuid, _move_to uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_offset double precision;
begin
  if not public.can_access_ideas() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select count(*) into v_count from public.ideas where stage_id = _stage_id;

  if v_count > 0 then
    if _move_to is null or _move_to = _stage_id then
      raise exception 'Escolha outra etapa para receber as ideias desta etapa.';
    end if;
    if not exists (select 1 from public.idea_stages where id = _move_to) then
      raise exception 'Etapa de destino não encontrada.';
    end if;

    select coalesce(max(position), 0) + 1 into v_offset from public.ideas where stage_id = _move_to;
    update public.ideas
    set stage_id = _move_to, position = position + v_offset
    where stage_id = _stage_id;
  end if;

  delete from public.idea_stages where id = _stage_id;
end;
$$;

-- Anexos (bucket privado)
drop policy if exists "idea_attachments_storage_select" on storage.objects;
create policy "idea_attachments_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'idea-attachments' and (select public.can_access_ideas()));

drop policy if exists "idea_attachments_storage_insert" on storage.objects;
create policy "idea_attachments_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'idea-attachments' and (select public.can_access_ideas()));

drop policy if exists "idea_attachments_storage_update" on storage.objects;
create policy "idea_attachments_storage_update" on storage.objects
for update to authenticated
using (bucket_id = 'idea-attachments' and (select public.can_access_ideas()))
with check (bucket_id = 'idea-attachments' and (select public.can_access_ideas()));

drop policy if exists "idea_attachments_storage_delete" on storage.objects;
create policy "idea_attachments_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'idea-attachments' and (select public.can_access_ideas()));
