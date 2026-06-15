-- Member suspension support
--
-- Adds the ability to suspend a member (e.g. after 3+ unexcused absences in a
-- semester, per the Termo de Compromisso). Suspension is reversible: the admin
-- can reactivate the member, which clears the suspension metadata.

-- 1) Suspension metadata columns on profiles
alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null,
  add column if not exists suspension_reason text;

-- 2) Allow 'suspended' as a profiles.status value.
--    The base schema may or may not define a CHECK constraint on status; drop
--    any status-related check constraint and recreate a known one that includes
--    'suspended' so the value is always accepted.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;

  alter table public.profiles
    add constraint profiles_status_check
    check (status in ('pending', 'active', 'rejected', 'suspended'));
end $$;

comment on column public.profiles.suspended_at is 'When the member was suspended (null = not suspended).';
comment on column public.profiles.suspended_by is 'Profile id of the admin who suspended the member.';
comment on column public.profiles.suspension_reason is 'Reason shown to the suspended member.';
