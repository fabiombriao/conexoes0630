-- Autoconfirmação de presença por geolocalização
--
-- O membro confirma a própria presença pelo app, desde que esteja a no máximo
-- 100 metros do local da reunião (-31.7570381, -52.3392279). A distância é
-- calculada e validada NO SERVIDOR (RPC confirm_self_attendance); o cliente só
-- envia as coordenadas lidas pelo GPS. Não há policy de INSERT: a única forma de
-- gravar na tabela é pela RPC.
--
-- A confirmação NÃO gera pontos por si só: ela serve de apoio para quem faz a
-- chamada (Presença). Os pontos continuam saindo da lista aprovada pelo Super Admin.

-- 1) Distância (Haversine) em metros entre dois pontos lat/lng em graus.
create or replace function public.haversine_distance_m(
  _lat1 double precision,
  _lon1 double precision,
  _lat2 double precision,
  _lon2 double precision
)
returns double precision
language sql
immutable
parallel safe
set search_path = public
as $$
  select 2 * 6371000.0 * asin(
    least(1.0, sqrt(
      power(sin(radians(_lat2 - _lat1) / 2), 2)
      + cos(radians(_lat1)) * cos(radians(_lat2))
        * power(sin(radians(_lon2 - _lon1) / 2), 2)
    ))
  );
$$;

-- 2) Confirmações de presença feitas pelo próprio membro.
create table if not exists public.attendance_self_checkins (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  checked_in_at timestamptz not null default now(),
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  distance_m double precision not null,
  unique (member_id, session_date)
);

create index if not exists attendance_self_checkins_group_date_idx
  on public.attendance_self_checkins (group_id, session_date);

comment on table public.attendance_self_checkins is
  'Presença autoconfirmada pelo membro via GPS (raio máx. 100 m do local da reunião). Gravada somente pela RPC confirm_self_attendance.';

alter table public.attendance_self_checkins enable row level security;

-- O membro enxerga as próprias confirmações; Super Admin (role admin) e líderes
-- (group_leader) do grupo enxergam as do grupo para apoiar a chamada.
drop policy if exists "self_checkins_select" on public.attendance_self_checkins;
create policy "self_checkins_select"
on public.attendance_self_checkins
for select
to authenticated
using (
  member_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin')
  or (
    public.has_role((select auth.uid()), 'group_leader')
    and group_id = public.get_user_group_id((select auth.uid()))
  )
);

revoke all on public.attendance_self_checkins from anon, authenticated;
grant select on public.attendance_self_checkins to authenticated;

-- 3) RPC: valida e registra a confirmação.
--    Retorna jsonb { status, distance_m?, max_distance_m, ... } com status em:
--      confirmed | already_confirmed | too_far | low_accuracy | not_active | no_group | invalid_location
create or replace function public.confirm_self_attendance(
  _latitude double precision,
  _longitude double precision,
  _accuracy double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Local da reunião e limites (ajuste aqui se o local ou o raio mudarem).
  c_target_lat constant double precision := -31.7570381;
  c_target_lon constant double precision := -52.3392279;
  c_max_distance_m constant double precision := 100;
  c_max_accuracy_m constant double precision := 100;

  v_uid uuid := auth.uid();
  v_status text;
  v_group_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_distance double precision;
  v_existing double precision;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select status into v_status from public.profiles where id = v_uid;
  if v_status is distinct from 'active' then
    return jsonb_build_object('status', 'not_active', 'max_distance_m', c_max_distance_m);
  end if;

  v_group_id := public.get_user_group_id(v_uid);
  if v_group_id is null then
    return jsonb_build_object('status', 'no_group', 'max_distance_m', c_max_distance_m);
  end if;

  -- Já confirmou hoje? Resposta idempotente.
  select distance_m into v_existing
  from public.attendance_self_checkins
  where member_id = v_uid and session_date = v_today;
  if found then
    return jsonb_build_object(
      'status', 'already_confirmed',
      'distance_m', v_existing,
      'max_distance_m', c_max_distance_m
    );
  end if;

  if _latitude is null or _longitude is null
     or _latitude not between -90 and 90
     or _longitude not between -180 and 180
     or _latitude = 'NaN'::double precision
     or _longitude = 'NaN'::double precision then
    return jsonb_build_object('status', 'invalid_location', 'max_distance_m', c_max_distance_m);
  end if;

  -- Posição imprecisa (ex.: localização por IP/Wi-Fi) não vale como prova.
  if _accuracy is null or _accuracy <> _accuracy or _accuracy < 0 or _accuracy > c_max_accuracy_m then
    return jsonb_build_object(
      'status', 'low_accuracy',
      'accuracy_m', _accuracy,
      'max_accuracy_m', c_max_accuracy_m,
      'max_distance_m', c_max_distance_m
    );
  end if;

  v_distance := round(
    public.haversine_distance_m(_latitude, _longitude, c_target_lat, c_target_lon)::numeric,
    1
  )::double precision;

  if v_distance > c_max_distance_m then
    return jsonb_build_object(
      'status', 'too_far',
      'distance_m', v_distance,
      'max_distance_m', c_max_distance_m
    );
  end if;

  insert into public.attendance_self_checkins
    (group_id, member_id, session_date, latitude, longitude, accuracy_m, distance_m)
  values
    (v_group_id, v_uid, v_today, _latitude, _longitude, _accuracy, v_distance)
  on conflict (member_id, session_date) do nothing;

  return jsonb_build_object(
    'status', 'confirmed',
    'distance_m', v_distance,
    'max_distance_m', c_max_distance_m
  );
end;
$$;

revoke all on function public.confirm_self_attendance(double precision, double precision, double precision) from public, anon;
grant execute on function public.confirm_self_attendance(double precision, double precision, double precision) to authenticated;
