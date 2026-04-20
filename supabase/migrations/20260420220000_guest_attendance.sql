-- Guest attendance (visitor invitations) sessions + records
-- Adds approval flow similar to member attendance and awards points on approval.

create table if not exists public.guest_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id),
  session_date date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  status public.attendance_session_status not null default 'pending_approval',
  approved_at timestamptz null,
  approved_by uuid null references public.profiles(id),
  rejection_reason text null,
  is_test boolean not null default false
);

create index if not exists guest_attendance_sessions_group_date_idx
  on public.guest_attendance_sessions (group_id, session_date);

create table if not exists public.guest_attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.guest_attendance_sessions(id) on delete cascade,
  invitation_id uuid not null references public.visitor_invitations(id),
  invited_by uuid not null references public.profiles(id),
  status public.attendance_record_status not null,
  created_at timestamptz not null default now(),
  unique (session_id, invitation_id)
);

create index if not exists guest_attendance_records_session_idx
  on public.guest_attendance_records (session_id);

create index if not exists guest_attendance_records_invited_by_idx
  on public.guest_attendance_records (invited_by);

-- Award points when a guest attendance session is approved:
-- 2 points per guest marked present for the member who invited them.
create or replace function public.apply_guest_attendance_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start date;
  month_text text;
  row record;
begin
  if (tg_op = 'UPDATE')
    and (new.status = 'approved')
    and (old.status is distinct from 'approved')
  then
    month_start := date_trunc('month', new.session_date)::date;
    month_text := to_char(month_start, 'YYYY-MM-DD');

    for row in
      select invited_by, (count(*)::int * 2) as points
      from public.guest_attendance_records
      where session_id = new.id
        and status = 'present'
      group by invited_by
    loop
      perform public.upsert_ranking_points(
        _group_id := new.group_id,
        _month := month_text,
        _member_id := row.invited_by,
        _presence := row.points
      );
    end loop;

    perform public.recalculate_ranking_positions(new.group_id, month_text);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_guest_attendance_points on public.guest_attendance_sessions;
create trigger trg_apply_guest_attendance_points
after update of status on public.guest_attendance_sessions
for each row
execute function public.apply_guest_attendance_points();

-- RLS
alter table public.guest_attendance_sessions enable row level security;
alter table public.guest_attendance_records enable row level security;

-- Sessions: members of the group (or superadmin) can read.
drop policy if exists "guest_sessions_select" on public.guest_attendance_sessions;
create policy "guest_sessions_select"
on public.guest_attendance_sessions
for select
to authenticated
using (
  public.has_role('admin', auth.uid())
  or public.get_user_group_id(auth.uid()) = group_id
);

-- Sessions: group leader/admin of the group can create.
drop policy if exists "guest_sessions_insert" on public.guest_attendance_sessions;
create policy "guest_sessions_insert"
on public.guest_attendance_sessions
for insert
to authenticated
with check (
  public.get_user_group_id(auth.uid()) = group_id
  and (public.has_role('admin', auth.uid()) or public.has_role('group_leader', auth.uid()))
);

-- Sessions: only superadmin can approve/reject.
drop policy if exists "guest_sessions_update_superadmin" on public.guest_attendance_sessions;
create policy "guest_sessions_update_superadmin"
on public.guest_attendance_sessions
for update
to authenticated
using (public.has_role('admin', auth.uid()))
with check (public.has_role('admin', auth.uid()));

-- Records: members of the group (or superadmin) can read via the session.
drop policy if exists "guest_records_select" on public.guest_attendance_records;
create policy "guest_records_select"
on public.guest_attendance_records
for select
to authenticated
using (
  public.has_role('admin', auth.uid())
  or exists (
    select 1
    from public.guest_attendance_sessions s
    where s.id = session_id
      and s.group_id = public.get_user_group_id(auth.uid())
  )
);

-- Records: group leader/admin can create within their group via the session.
drop policy if exists "guest_records_insert" on public.guest_attendance_records;
create policy "guest_records_insert"
on public.guest_attendance_records
for insert
to authenticated
with check (
  exists (
    select 1
    from public.guest_attendance_sessions s
    where s.id = session_id
      and s.group_id = public.get_user_group_id(auth.uid())
      and (public.has_role('admin', auth.uid()) or public.has_role('group_leader', auth.uid()))
  )
);

