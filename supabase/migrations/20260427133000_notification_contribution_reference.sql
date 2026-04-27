-- Stable contribution references for referral notifications.
-- Adds a structured contribution link to notifications and keeps one_to_one flows unchanged.

alter table public.notifications
  add column if not exists contribution_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_contribution_id_fkey'
  ) then
    alter table public.notifications
      add constraint notifications_contribution_id_fkey
      foreign key (contribution_id)
      references public.contributions(id)
      on delete set null;
  end if;
end $$;

create index if not exists notifications_contribution_id_idx
  on public.notifications (contribution_id);

create or replace function public.create_notification(
  _user_id uuid,
  _type text,
  _title text,
  _message text,
  _link text default null,
  _contribution_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    link,
    contribution_id,
    read
  )
  values (
    _user_id,
    _type,
    _title,
    _message,
    _link,
    _contribution_id,
    false
  );
end;
$$;

create or replace function public.on_contribution_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _sender_name text;
  _referral_owner uuid;
begin
  select full_name into _sender_name from public.profiles where id = new.user_id;
  _sender_name := coalesce(_sender_name, 'Um membro');

  if new.type = 'referral' and new.referred_to is not null then
    perform create_notification(
      new.referred_to,
      'indicacao',
      'Nova Indicação Recebida 🤝',
      _sender_name || ' fez uma indicação para você: ' || coalesce(new.contact_name, 'novo contato'),
      '/notifications?contribution_id=' || new.id::text,
      new.id
    );
  end if;

  if new.type = 'onf' and new.related_referral_id is not null then
    select user_id into _referral_owner from public.contributions where id = new.related_referral_id;
    if _referral_owner is not null and _referral_owner <> new.user_id then
      perform create_notification(
        _referral_owner,
        'negocio_fechado',
        'Negócio Fechado! 🎉',
        _sender_name || ' registrou um negócio fechado relacionado à sua indicação: R$ ' || coalesce(new.business_value::text, '0'),
        '/contributions'
      );
    end if;
  end if;

  if new.type = 'one_to_one' and new.meeting_member_id is not null then
    perform create_notification(
      new.meeting_member_id,
      'tete_a_tete',
      'Téte a téte Registrado ☕',
      _sender_name || ' registrou um téte a téte com você',
      '/contributions'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_contribution_notify on public.contributions;
create trigger on_contribution_notify
after insert on public.contributions
for each row
execute function public.on_contribution_notify();

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
    _link := '/contributions?focus=received-referrals&contribution_id=' || contribution_row.id::text,
    _contribution_id := contribution_row.id
  );
end;
$$;
