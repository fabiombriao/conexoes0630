-- Quadro de ideias (CRM de ideias) — acesso exclusivo do Super Admin (role 'admin')
--
-- Etapas configuráveis (nome, ordem, cor, final, arquivada), ideias com tarefas
-- (checklist), valores (único/recorrente, ganho/custo), observações em linha do
-- tempo, etiquetas, anexos (bucket privado) e histórico de movimentação.
-- Todas as tabelas têm RLS liberando somente o Super Admin. Para liberar a outros
-- perfis no futuro, troque o predicado das policies por uma permissão nova.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.idea_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  color text not null default '#64748b',
  position integer not null default 0,
  is_final boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.idea_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  color text not null default '#f97316',
  created_at timestamptz not null default now()
);
create unique index if not exists idea_tags_name_key on public.idea_tags (lower(name));

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references public.idea_stages(id) on delete restrict,
  title text not null check (length(btrim(title)) > 0),
  description text,
  origin text not null default 'app' check (origin in ('app', 'group', 'member')),
  suggested_by_member_id uuid references public.profiles(id) on delete set null,
  suggested_by_name text,
  assignee_id uuid references public.profiles(id) on delete set null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  position double precision not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ideas_stage_position_idx on public.ideas (stage_id, position);
create index if not exists ideas_assignee_idx on public.ideas (assignee_id);

create table if not exists public.idea_tag_links (
  idea_id uuid not null references public.ideas(id) on delete cascade,
  tag_id uuid not null references public.idea_tags(id) on delete cascade,
  primary key (idea_id, tag_id)
);
create index if not exists idea_tag_links_tag_idx on public.idea_tag_links (tag_id);

create table if not exists public.idea_tasks (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  title text not null check (length(btrim(title)) > 0),
  description text,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  is_done boolean not null default false,
  done_at timestamptz,
  position double precision not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idea_tasks_idea_idx on public.idea_tasks (idea_id, position);

create table if not exists public.idea_values (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  label text,
  amount numeric(14, 2) not null check (amount >= 0),
  nature text not null check (nature in ('gain', 'cost')),
  kind text not null check (kind in ('one_time', 'recurring')),
  period text check (period in ('monthly', 'quarterly', 'semiannual', 'annual')),
  created_at timestamptz not null default now(),
  -- recorrente exige periodicidade; único não tem
  constraint idea_values_period_ck check ((kind = 'recurring') = (period is not null))
);
create index if not exists idea_values_idea_idx on public.idea_values (idea_id);

create table if not exists public.idea_notes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idea_notes_idea_idx on public.idea_notes (idea_id, created_at);

create table if not exists public.idea_attachments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  task_id uuid references public.idea_tasks(id) on delete cascade,
  note_id uuid references public.idea_notes(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint idea_attachments_one_owner_ck check (not (task_id is not null and note_id is not null))
);
create index if not exists idea_attachments_idea_idx on public.idea_attachments (idea_id);
create index if not exists idea_attachments_task_idx on public.idea_attachments (task_id);
create index if not exists idea_attachments_note_idx on public.idea_attachments (note_id);

create table if not exists public.idea_history (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  from_stage_id uuid references public.idea_stages(id) on delete set null,
  to_stage_id uuid references public.idea_stages(id) on delete set null,
  from_stage_name text,
  to_stage_name text,
  moved_by uuid references public.profiles(id) on delete set null,
  moved_at timestamptz not null default now()
);
create index if not exists idea_history_idea_idx on public.idea_history (idea_id, moved_at);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.ideas_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists idea_stages_touch on public.idea_stages;
create trigger idea_stages_touch before update on public.idea_stages
for each row execute function public.ideas_touch_updated_at();

drop trigger if exists ideas_touch on public.ideas;
create trigger ideas_touch before update on public.ideas
for each row execute function public.ideas_touch_updated_at();

-- done_at acompanha a marcação de concluída da tarefa.
create or replace function public.idea_tasks_set_done_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.is_done then
    if tg_op = 'INSERT' or not old.is_done then
      new.done_at := now();
    end if;
  else
    new.done_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists idea_tasks_done_at on public.idea_tasks;
create trigger idea_tasks_done_at before insert or update on public.idea_tasks
for each row execute function public.idea_tasks_set_done_at();

-- Histórico de movimentação (criação e troca de etapa), com o nome da etapa
-- guardado para continuar legível mesmo se a etapa for renomeada ou excluída.
create or replace function public.ideas_log_stage_move()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_name text;
  v_to_name text;
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  select name into v_to_name from public.idea_stages where id = new.stage_id;
  if tg_op = 'UPDATE' then
    select name into v_from_name from public.idea_stages where id = old.stage_id;
  end if;

  insert into public.idea_history (idea_id, from_stage_id, to_stage_id, from_stage_name, to_stage_name, moved_by)
  values (
    new.id,
    case when tg_op = 'UPDATE' then old.stage_id end,
    new.stage_id,
    v_from_name,
    v_to_name,
    auth.uid()
  );
  return new;
end;
$$;

drop trigger if exists ideas_log_stage_move_trg on public.ideas;
create trigger ideas_log_stage_move_trg after insert or update of stage_id on public.ideas
for each row execute function public.ideas_log_stage_move();

-- ---------------------------------------------------------------------------
-- RLS: somente Super Admin
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'idea_stages', 'idea_tags', 'ideas', 'idea_tag_links',
    'idea_tasks', 'idea_values', 'idea_notes', 'idea_attachments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_superadmin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.has_role((select auth.uid()), ''admin''::public.app_role)) '
      || 'with check (public.has_role((select auth.uid()), ''admin''::public.app_role))',
      t || '_superadmin_all', t
    );
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Histórico: somente leitura (gravado pelo trigger).
alter table public.idea_history enable row level security;
drop policy if exists idea_history_superadmin_select on public.idea_history;
create policy idea_history_superadmin_select on public.idea_history
for select to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));
revoke all on public.idea_history from anon, authenticated;
grant select on public.idea_history to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de etapas
-- ---------------------------------------------------------------------------

-- Reordena as etapas na ordem do array recebido.
create or replace function public.reorder_idea_stages(_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.idea_stages s
  set position = o.ord::integer
  from unnest(_ids) with ordinality as o(id, ord)
  where s.id = o.id;
end;
$$;

-- Exclui uma etapa; se houver ideias nela, elas vão para _move_to (obrigatório).
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
  if not public.has_role(auth.uid(), 'admin'::public.app_role) then
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

revoke all on function public.reorder_idea_stages(uuid[]) from public, anon;
revoke all on function public.delete_idea_stage(uuid, uuid) from public, anon;
grant execute on function public.reorder_idea_stages(uuid[]) to authenticated;
grant execute on function public.delete_idea_stage(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Anexos: bucket privado (10 MB por arquivo), só Super Admin
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'idea-attachments',
  'idea-attachments',
  false,
  10485760,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "idea_attachments_storage_select" on storage.objects;
create policy "idea_attachments_storage_select" on storage.objects
for select to authenticated
using (bucket_id = 'idea-attachments' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "idea_attachments_storage_insert" on storage.objects;
create policy "idea_attachments_storage_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'idea-attachments' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "idea_attachments_storage_update" on storage.objects;
create policy "idea_attachments_storage_update" on storage.objects
for update to authenticated
using (bucket_id = 'idea-attachments' and public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (bucket_id = 'idea-attachments' and public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists "idea_attachments_storage_delete" on storage.objects;
create policy "idea_attachments_storage_delete" on storage.objects
for delete to authenticated
using (bucket_id = 'idea-attachments' and public.has_role((select auth.uid()), 'admin'::public.app_role));

-- ---------------------------------------------------------------------------
-- Etapas iniciais (só se ainda não existir nenhuma)
-- ---------------------------------------------------------------------------

insert into public.idea_stages (name, color, position, is_final)
select v.name, v.color, v.position, v.is_final
from (values
  ('Nova ideia',   '#64748b', 1, false),
  ('Em análise',   '#3b82f6', 2, false),
  ('Planejada',    '#a855f7', 3, false),
  ('Em andamento', '#f97316', 4, false),
  ('Concluída',    '#22c55e', 5, true),
  ('Descartada',   '#ef4444', 6, true)
) as v(name, color, position, is_final)
where not exists (select 1 from public.idea_stages);
