-- One-to-one acceptance flow for TRN
-- Adds member confirmation, pending notifications, and delayed ranking credit.

alter table public.contributions
  add column if not exists meeting_confirmation_status text null,
  add column if not exists meeting_confirmed_by uuid null references public.profiles(id),
  add column if not exists meeting_confirmed_at timestamptz null,
  add column if not exists meeting_declined_by uuid null references public.profiles(id),
  add column if not exists meeting_declined_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'contributions_meeting_confirmation_status_check'
  ) then
    alter table public.contributions
      add constraint contributions_meeting_confirmation_status_check
      check (
        meeting_confirmation_status is null
        or meeting_confirmation_status in ('pending', 'confirmed', 'declined')
      );
  end if;
end $$;

update public.contributions
set
  meeting_confirmation_status = 'confirmed',
  meeting_confirmed_by = coalesce(meeting_confirmed_by, meeting_member_id),
  meeting_confirmed_at = coalesce(meeting_confirmed_at, created_at),
  meeting_declined_by = null,
  meeting_declined_at = null
where type = 'one_to_one'
  and meeting_confirmation_status is distinct from 'confirmed';

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

  select coalesce(full_name, 'Um membro')
    into author_name
  from public.profiles
  where id = new.user_id;

  perform public.create_notification(
    _user_id := new.meeting_member_id,
    _title := 'Téte a téte para confirmar',
    _message := coalesce(author_name, 'Um membro') || ' registrou uma reunião Téte-a-téte com você. Confirme para contabilizar os pontos.',
    _type := 'one_to_one_pending',
    _link := '/contributions'
  );

  return new;
end;
$$;

drop trigger if exists trg_send_one_to_one_pending_notification on public.contributions;
create trigger trg_send_one_to_one_pending_notification
after insert on public.contributions
for each row
execute function public.send_one_to_one_pending_notification();

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

    perform public.upsert_ranking_points(
      _group_id := new.group_id,
      _month := month_text,
      _member_id := new.user_id,
      _tt := 2
    );

    if new.meeting_member_id is not null and new.meeting_member_id is distinct from new.user_id then
      perform public.upsert_ranking_points(
        _group_id := new.group_id,
        _month := month_text,
        _member_id := new.meeting_member_id,
        _tt := 2
      );
    end if;

    perform public.recalculate_ranking_positions(new.group_id, month_text);

    perform public.create_notification(
      _user_id := new.user_id,
      _title := 'Téte a téte confirmado',
      _message := 'A sua reunião Téte-a-téte foi confirmada e os pontos foram contabilizados para ambos.',
      _type := 'one_to_one_confirmed',
      _link := '/contributions'
    );
  elsif new.meeting_confirmation_status = 'declined' then
    perform public.create_notification(
      _user_id := new.user_id,
      _title := 'Téte a téte recusado',
      _message := 'A sua reunião Téte-a-téte foi recusada pelo outro membro.',
      _type := 'one_to_one_declined',
      _link := '/contributions'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_one_to_one_confirmation_points on public.contributions;
create trigger trg_apply_one_to_one_confirmation_points
after update of meeting_confirmation_status on public.contributions
for each row
execute function public.apply_one_to_one_confirmation_points();

create or replace function public.resolve_one_to_one_contribution(_contribution_id uuid, _accepted boolean)
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
    raise exception 'TRN não encontrada';
  end if;

  if contribution_row.type <> 'one_to_one' then
    raise exception 'Apenas TRN de Téte-a-téte pode ser confirmada';
  end if;

  if contribution_row.meeting_member_id is null then
    raise exception 'TRN sem membro convidado';
  end if;

  if contribution_row.meeting_member_id <> auth.uid() then
    raise exception 'Você não pode responder esta TRN';
  end if;

  if contribution_row.meeting_confirmation_status is distinct from 'pending' then
    raise exception 'TRN já foi resolvida';
  end if;

  update public.contributions
  set
    meeting_confirmation_status = case when _accepted then 'confirmed' else 'declined' end,
    meeting_confirmed_by = case when _accepted then auth.uid() else null end,
    meeting_confirmed_at = case when _accepted then now() else null end,
    meeting_declined_by = case when _accepted then null else auth.uid() end,
    meeting_declined_at = case when _accepted then null else now() end
  where id = _contribution_id;
end;
$$;

alter table public.contributions enable row level security;

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
);

