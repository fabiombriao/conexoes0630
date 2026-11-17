-- Permite que o autor de um Negócio Fechado (onf) edite valor, com quem o negócio
-- foi fechado (membro do grupo ou cliente externo) e a descrição.
-- Complementa update_deal_value (que continua existindo por compatibilidade).

create or replace function public.update_deal(
  _contribution_id uuid,
  _business_value numeric,
  _referred_to uuid,
  _notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contribution_row public.contributions%rowtype;
begin
  select *
    into contribution_row
  from public.contributions
  where id = _contribution_id
  for update;

  if contribution_row.id is null then
    raise exception 'Contribuição não encontrada';
  end if;

  if contribution_row.type <> 'onf' then
    raise exception 'Apenas negócios fechados podem ser editados';
  end if;

  if contribution_row.user_id <> auth.uid() then
    raise exception 'Você não pode editar esta contribuição';
  end if;

  if _business_value is null or _business_value < 0 then
    raise exception 'Valor inválido';
  end if;

  -- null = cliente externo; caso contrário precisa ser um membro do mesmo grupo.
  if _referred_to is not null then
    if _referred_to = contribution_row.user_id then
      raise exception 'O negócio não pode ser fechado com você mesmo';
    end if;
    if not exists (
      select 1
      from public.group_members gm
      where gm.user_id = _referred_to
        and gm.group_id = contribution_row.group_id
    ) then
      raise exception 'Membro não encontrado no grupo';
    end if;
  end if;

  update public.contributions
  set business_value = _business_value,
      referred_to = _referred_to,
      notes = nullif(btrim(coalesce(_notes, '')), '')
  where id = _contribution_id;
end;
$$;

revoke all on function public.update_deal(uuid, numeric, uuid, text) from public, anon;
grant execute on function public.update_deal(uuid, numeric, uuid, text) to authenticated;
