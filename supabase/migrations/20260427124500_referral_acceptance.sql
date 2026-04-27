-- Referral acceptance preview/acknowledgement
-- Allows the referred member to open the contribution, preview it, and accept it.

create or replace function public.accept_referral_contribution(_contribution_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  contribution_row public.contributions%rowtype;
  sender_name text;
  recipient_name text;
begin
  select *
    into contribution_row
  from public.contributions
  where id = _contribution_id
  for update;

  if contribution_row.id is null then
    raise exception 'Indicação não encontrada';
  end if;

  if contribution_row.type <> 'referral' then
    raise exception 'Apenas indicações podem ser aceitas por este fluxo';
  end if;

  if contribution_row.referred_to is null then
    raise exception 'Indicação sem destinatário';
  end if;

  if contribution_row.referred_to <> auth.uid() then
    raise exception 'Você não pode aceitar esta indicação';
  end if;

  update public.contributions
  set referral_status = case
    when referral_status = 'closed_won' then referral_status
    when referral_status = 'closed_lost' then referral_status
    else 'pending'
  end
  where id = _contribution_id;

  select coalesce(full_name, 'Um membro')
    into sender_name
  from public.profiles
  where id = contribution_row.user_id;

  select coalesce(full_name, 'Membro')
    into recipient_name
  from public.profiles
  where id = auth.uid();

  perform public.create_notification(
    _user_id := contribution_row.user_id,
    _title := 'Indicação aceita',
    _message := recipient_name || ' aceitou a indicação para ' || coalesce(contribution_row.contact_name, 'um contato'),
    _type := 'referral_accepted',
    _link := '/contributions?focus=received-referrals'
  );
end;
$$;

drop policy if exists "contributions_select_own_or_received_one_to_one" on public.contributions;
create policy "contributions_select_own_or_received_one_to_one"
on public.contributions
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    type = 'one_to_one'
    and meeting_member_id = auth.uid()
  )
or (
    type = 'referral'
    and referred_to = auth.uid()
  )
);
