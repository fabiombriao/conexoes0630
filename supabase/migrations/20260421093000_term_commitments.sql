-- Term commitment flow
-- Stores versioned term content, member signature state, and signed PDFs.

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'term_commitment_status'
  ) then
    create type public.term_commitment_status as enum ('pending', 'sent', 'signed', 'declined');
  end if;
end $$;

create table if not exists public.term_commitment_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique,
  title text not null,
  content_markdown text not null,
  is_active boolean not null default false,
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists term_commitment_versions_only_one_active_idx
  on public.term_commitment_versions (is_active)
  where is_active;

create table if not exists public.term_commitments (
  id uuid primary key default gen_random_uuid(),
  term_version_id uuid not null references public.term_commitment_versions(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  status public.term_commitment_status not null default 'pending',
  cpf text null,
  pdf_path text null,
  sent_at timestamptz null,
  signed_at timestamptz null,
  declined_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (term_version_id, member_id)
);

create index if not exists term_commitments_member_idx
  on public.term_commitments (member_id);

create index if not exists term_commitments_version_idx
  on public.term_commitments (term_version_id);

create index if not exists term_commitments_status_idx
  on public.term_commitments (status);

create or replace function public.touch_term_commitments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_term_commitments_updated_at on public.term_commitments;
create trigger trg_touch_term_commitments_updated_at
before update on public.term_commitments
for each row
execute function public.touch_term_commitments_updated_at();

create or replace function public.seed_term_commitments_for_active_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_term_version_id uuid;
begin
  if new.status = 'active' then
    select id
      into active_term_version_id
    from public.term_commitment_versions
    where is_active
    order by version desc
    limit 1;

    if active_term_version_id is not null then
      insert into public.term_commitments (term_version_id, member_id, status)
      values (active_term_version_id, new.id, 'pending')
      on conflict (term_version_id, member_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_seed_term_commitments_for_active_profile on public.profiles;
create trigger trg_seed_term_commitments_for_active_profile
after insert or update of status on public.profiles
for each row
execute function public.seed_term_commitments_for_active_profile();

create or replace function public.seed_term_commitments_for_active_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    insert into public.term_commitments (term_version_id, member_id, status)
    select new.id, p.id, 'pending'
    from public.profiles p
    where p.status = 'active'
    on conflict (term_version_id, member_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_seed_term_commitments_for_active_version on public.term_commitment_versions;
create trigger trg_seed_term_commitments_for_active_version
after insert or update of is_active on public.term_commitment_versions
for each row
execute function public.seed_term_commitments_for_active_version();

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
    _link := '/termo-compromisso'
  );
end;
$$;

insert into public.term_commitment_versions (version, title, content_markdown, is_active)
values (
  1,
  'TERMO DE ADESÃO –  CONEXÃO 6:30',
  $term$
TERMO DE ADESÃO –  CONEXÃO 6:30  

 

Seja bem -vindo ao Conexão 6:30.  
 

Este é um grupo de networking estratégico, criado para empresários, líderes e 
profissionais que buscam crescimento real através de conexões genuínas, 

disciplina e geração de oportunidades.  
 

Ao aderir ao grupo, o participante declara estar ciente e de acordo com as 
diretrizes abaixo:  

 

1. PROPÓSITO DO GRUPO  

-  Gerar conexões verdadeiras e duradouras  

-  Estimular oportunidades de negócios entre os membros  
-  Desenvolver habilidades de comunicação, posicionamento e networking  

-  Criar um ambiente de crescimento mútuo e colaboração  

 

2. COMPROMISSO COM OS ENCONTROS  
-  Os encontros acontecem semanalmente, às terças -feiras, às 06:30 da manhã  

-  A pontualidade é indispensável  
-  O participante deve comparecer com postura profissional e participativa  

 

3. PRESENÇA E RESPONSABILIDADE  

-  Cada membro tem direito a até 3 faltas por semestre  

-  As faltas serão abonadas caso o participante envie um representante 
qualificado em seu lugar  

-  O representante deve estar alinhado com os objetivos do grupo e apto a gerar 
conexões  

-  A ausência sem reposição será considerada falta efetiva  
-  O não cumprimento das diretrizes poderá resultar em desligamento do grupo  

 

 

 

 

4. BENEFÍCIOS DO MEMBRO  

-  Ambiente qualificado de networking e geração de negócios  
-  Possibilidade de apresentar seu negócio e fortalecer sua autoridade  

-  Conexões estratégicas com outros empresários e profissionais  
-  Direito de solicitar recomendações e indicações dentro do grupo, de forma 

ética  

 

5. POSTURA E CULTURA DO GRUPO  
-  Contribuir ativamente com o grupo  

-  Gerar valor antes de esperar retorno  
-  Respeitar todos os membros  

-  Manter ética profissional nas relações e indicações  
-  Evitar comportamentos oportunistas  

 

6. INVESTIMENTO E FORMA DE PAGAMENTO  
-  Contribuição mensal de R$ 177,00  

-  Pagamento antecipado  
-  Inadimplência pode resultar em suspensão ou desligamento  

 

7. SOBRE O POSICIONAMENTO DO GRUPO  

-  Relacionamentos são construídos com intenção  
-  Negócios são consequência da conexão  

-  Disciplina é o diferencial de quem cresce  

 

8. ACEITE  

O participante declara estar ciente e de acordo com todas as diretrizes acima.  

 

Conexão 6:30  
O sucesso tem um horário preferido.  

 

Conexões 6:30    _______________________________________________________ 

Novo membro    ____________________________________________
  $term$,
  true
)
on conflict (version)
do update set
  title = excluded.title,
  content_markdown = excluded.content_markdown,
  is_active = excluded.is_active;

alter table public.term_commitment_versions enable row level security;
alter table public.term_commitments enable row level security;

drop policy if exists "term_commitment_versions_select" on public.term_commitment_versions;
create policy "term_commitment_versions_select"
on public.term_commitment_versions
for select
to authenticated
using (is_active or public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "term_commitment_versions_manage_superadmin" on public.term_commitment_versions;
create policy "term_commitment_versions_manage_superadmin"
on public.term_commitment_versions
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "term_commitments_select" on public.term_commitments;
create policy "term_commitments_select"
on public.term_commitments
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or member_id = auth.uid()
);

drop policy if exists "term_commitments_manage_superadmin" on public.term_commitments;
create policy "term_commitments_manage_superadmin"
on public.term_commitments
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'::public.app_role))
with check (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "term_commitments_member_self_manage" on public.term_commitments;
create policy "term_commitments_member_self_manage"
on public.term_commitments
for insert
to authenticated
with check (
  member_id = auth.uid()
  and status in ('signed', 'declined')
);

drop policy if exists "term_commitments_member_self_update" on public.term_commitments;
create policy "term_commitments_member_self_update"
on public.term_commitments
for update
to authenticated
using (member_id = auth.uid())
with check (
  member_id = auth.uid()
  and status in ('signed', 'declined')
);

insert into storage.buckets (id, name, public)
values ('term-commitments', 'term-commitments', false)
on conflict (id) do nothing;

drop policy if exists "term_commitments_storage_select" on storage.objects;
create policy "term_commitments_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'term-commitments'
  and (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

drop policy if exists "term_commitments_storage_insert" on storage.objects;
create policy "term_commitments_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'term-commitments'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists "term_commitments_storage_update" on storage.objects;
create policy "term_commitments_storage_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'term-commitments'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'term-commitments'
  and split_part(name, '/', 1) = auth.uid()::text
);
