-- Simplify referral status to the two product states:
-- pending = waiting for the recipient to accept
-- accepted = the recipient already accepted the referral

do $$
declare
  status_labels text[];
begin
  select array_agg(e.enumlabel order by e.enumsortorder)
    into status_labels
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
  join pg_enum e on e.enumtypid = t.oid
  where n.nspname = 'public'
    and t.typname = 'referral_status';

  if status_labels is distinct from array['pending', 'accepted']::text[] then
    if exists (
      select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'referral_status'
    ) then
      alter type public.referral_status rename to referral_status_legacy;
    end if;

    create type public.referral_status as enum ('pending', 'accepted');

    alter table public.contributions
      alter column referral_status drop default;

    alter table public.contributions
      alter column referral_status type public.referral_status
      using (
        case
          when referral_status::text = 'accepted' then 'accepted'
          when referral_status::text = 'closed_won' then 'accepted'
          else 'pending'
        end
      )::public.referral_status;

    if exists (
      select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'referral_status_legacy'
    ) then
      drop type public.referral_status_legacy;
    end if;
  end if;
end $$;

update public.contributions c
set referral_status = 'accepted'
where c.type = 'referral'
  and exists (
    select 1
    from public.notifications n
    where n.contribution_id = c.id
      and n.type = 'referral_accepted'
  )
  and c.referral_status::text <> 'accepted';

alter table public.contributions
  alter column referral_status set default 'pending'::public.referral_status;

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
  set referral_status = 'accepted'
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
