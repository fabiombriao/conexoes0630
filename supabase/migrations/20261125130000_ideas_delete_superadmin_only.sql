-- Excluir ideias e etapas do quadro é só do Super Admin.
-- A Comissão continua podendo ver, criar e editar tudo no quadro.
--
-- Policies RESTRITIVAS se somam (AND) à policy "<tabela>_team_all", então só o
-- DELETE fica mais fechado. select/insert/update não mudam.

drop policy if exists ideas_delete_superadmin_only on public.ideas;
create policy ideas_delete_superadmin_only on public.ideas
as restrictive for delete to authenticated
using ((select public.has_role(auth.uid(), 'admin'::public.app_role)));

drop policy if exists idea_stages_delete_superadmin_only on public.idea_stages;
create policy idea_stages_delete_superadmin_only on public.idea_stages
as restrictive for delete to authenticated
using ((select public.has_role(auth.uid(), 'admin'::public.app_role)));

-- A RPC é security definer (ignora RLS), então precisa da própria checagem.
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
  if not coalesce(public.has_role(auth.uid(), 'admin'::public.app_role), false) then
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
