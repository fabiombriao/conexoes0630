-- Permite que o autor de um Negócio Fechado (onf) corrija o valor registrado,
-- comum quando o membro digita o valor com zeros a menos/a mais.

create or replace function public.update_deal_value(_contribution_id uuid, _business_value numeric)
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
    raise exception 'Apenas negócios fechados podem ter o valor editado';
  end if;

  if contribution_row.user_id <> auth.uid() then
    raise exception 'Você não pode editar esta contribuição';
  end if;

  if _business_value is null or _business_value < 0 then
    raise exception 'Valor inválido';
  end if;

  update public.contributions
  set business_value = _business_value
  where id = _contribution_id;
end;
$$;
