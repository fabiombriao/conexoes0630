-- Fix legacy notification overloads.
-- The bug came from the old 5-arg create_notification coexisting with the newer 6-arg version in Supabase.
-- Keep the business flow the same; only make notification dispatch explicit and safe.

drop function if exists public.create_notification(uuid, text, text, text, text);
drop function if exists public.create_notification(uuid, character varying, character varying, character varying, character varying);

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
  if not exists (
    select 1
    from public.profiles
    where id = _user_id
  ) then
    return;
  end if;

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

create or replace function public.send_term_commitment_notification(_member_id uuid, _term_version_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  version_title text;
begin
  select title
    into version_title
  from public.term_commitment_versions
  where id = _term_version_id;

  if version_title is null then
    raise exception 'Term version not found';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = _member_id
  ) then
    return;
  end if;

  insert into public.term_commitments (
    term_version_id,
    member_id,
    status,
    sent_at
  )
  values (
    _term_version_id,
    _member_id,
    'sent',
    now()
  )
  on conflict (term_version_id, member_id)
  do update set
    status = case
      when public.term_commitments.status = 'signed' then public.term_commitments.status
      else 'sent'
    end,
    sent_at = case
      when public.term_commitments.status = 'signed' then public.term_commitments.sent_at
      else now()
    end,
    declined_at = case
      when public.term_commitments.status = 'signed' then public.term_commitments.declined_at
      else null
    end;

  if exists (
    select 1
    from public.term_commitments
    where term_version_id = _term_version_id
      and member_id = _member_id
      and status = 'signed'
  ) then
    return;
  end if;

  perform public.create_notification(
    _user_id := _member_id,
    _title := 'Termo de compromisso disponível',
    _message := 'Você recebeu um novo termo de compromisso para assinar. Abra a notificação e conclua a assinatura.',
    _type := 'term_commitment',
    _link := '/termo-compromisso',
    _contribution_id := null
  );
end;
$$;

create or replace function public.send_one_to_one_pending_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_name text;
begin
  if new.type <> 'one_to_one' then
    return new;
  end if;

  if new.meeting_confirmation_status is distinct from 'pending' then
    return new;
  end if;

  if new.meeting_member_id is null or new.meeting_member_id = new.user_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = new.meeting_member_id
  ) then
    return new;
  end if;

  select coalesce(full_name, 'Um membro')
    into author_name
  from public.profiles
  where id = new.user_id;

  perform public.create_notification(
    _user_id := new.meeting_member_id,
    _title := 'Téte a téte para confirmar',
    _message := coalesce(author_name, 'Um membro') || ' registrou uma reunião Téte-a-téte com você. Confirme para contabilizar os pontos.',
    _type := 'one_to_one_pending',
    _link := '/contributions',
    _contribution_id := null
  );

  return new;
end;
$$;

create or replace function public.apply_one_to_one_confirmation_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  month_text text;
begin
  if new.type <> 'one_to_one' then
    return new;
  end if;

  if old.meeting_confirmation_status is not distinct from new.meeting_confirmation_status then
    return new;
  end if;

  if new.meeting_confirmation_status = 'confirmed' then
    month_text := to_char(date_trunc('month', new.contribution_date)::date, 'YYYY-MM-DD');

    if exists (
      select 1
      from public.profiles
      where id = new.user_id
    ) then
      perform public.upsert_ranking_points(
        _group_id := new.group_id,
        _month := month_text,
        _member_id := new.user_id,
        _tt := 2
      );
    end if;

    if new.meeting_member_id is not null and new.meeting_member_id is distinct from new.user_id then
      if exists (
        select 1
        from public.profiles
        where id = new.meeting_member_id
      ) then
        perform public.upsert_ranking_points(
          _group_id := new.group_id,
          _month := month_text,
          _member_id := new.meeting_member_id,
          _tt := 2
        );
      end if;
    end if;

    perform public.recalculate_ranking_positions(new.group_id, month_text);

    if exists (
      select 1
      from public.profiles
      where id = new.user_id
    ) then
      perform public.create_notification(
        _user_id := new.user_id,
        _title := 'Téte a téte confirmado',
        _message := 'A sua reunião Téte-a-téte foi confirmada e os pontos foram contabilizados para ambos.',
        _type := 'one_to_one_confirmed',
        _link := '/contributions',
        _contribution_id := null
      );
    end if;
  elsif new.meeting_confirmation_status = 'declined' then
    if exists (
      select 1
      from public.profiles
      where id = new.user_id
    ) then
      perform public.create_notification(
        _user_id := new.user_id,
        _title := 'Téte a téte recusado',
        _message := 'A sua reunião Téte-a-téte foi recusada pelo outro membro.',
        _type := 'one_to_one_declined',
        _link := '/contributions',
        _contribution_id := null
      );
    end if;
  end if;

  return new;
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
    if exists (
      select 1
      from public.profiles
      where id = new.referred_to
    ) then
      perform public.create_notification(
        _user_id := new.referred_to,
        _type := 'indicacao',
        _title := 'Nova Indicação Recebida 🤝',
        _message := _sender_name || ' fez uma indicação para você: ' || coalesce(new.contact_name, 'novo contato'),
        _link := '/notifications?contribution_id=' || new.id::text,
        _contribution_id := new.id
      );
    end if;
  end if;

  if new.type = 'onf' and new.related_referral_id is not null then
    select user_id into _referral_owner from public.contributions where id = new.related_referral_id;
    if _referral_owner is not null
      and _referral_owner <> new.user_id
      and exists (
        select 1
        from public.profiles
        where id = _referral_owner
      ) then
      perform public.create_notification(
        _user_id := _referral_owner,
        _type := 'negocio_fechado',
        _title := 'Negócio Fechado! 🎉',
        _message := _sender_name || ' registrou um negócio fechado relacionado à sua indicação: R$ ' || coalesce(new.business_value::text, '0'),
        _link := '/contributions',
        _contribution_id := null
      );
    end if;
  end if;

  if new.type = 'one_to_one' and new.meeting_member_id is not null then
    if new.meeting_member_id <> new.user_id
      and exists (
        select 1
        from public.profiles
        where id = new.meeting_member_id
      ) then
      perform public.create_notification(
        _user_id := new.meeting_member_id,
        _type := 'tete_a_tete',
        _title := 'Téte a téte Registrado ☕',
        _message := _sender_name || ' registrou um téte a téte com você',
        _link := '/contributions',
        _contribution_id := null
      );
    end if;
  end if;

  return new;
end;
$$;

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

  if exists (
    select 1
    from public.profiles
    where id = contribution_row.user_id
  ) then
    perform public.create_notification(
      _user_id := contribution_row.user_id,
      _title := 'Indicação aceita',
      _message := recipient_name || ' aceitou a indicação para ' || coalesce(contribution_row.contact_name, 'um contato'),
      _type := 'referral_accepted',
      _link := '/contributions?focus=received-referrals&contribution_id=' || contribution_row.id::text,
      _contribution_id := contribution_row.id
    );
  end if;
end;
$$;
