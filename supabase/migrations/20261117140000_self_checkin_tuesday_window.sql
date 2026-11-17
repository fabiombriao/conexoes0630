-- Janela de horário da autoconfirmação de presença
--
-- A confirmação só é aceita às TERÇAS-FEIRAS, das 06:30 às 09:00 (horário de
-- Brasília, America/Sao_Paulo). Em qualquer outro dia ou horário a RPC recusa
-- (status 'outside_window'). A checagem é feita no servidor, com o relógio do
-- banco, então não depende do relógio do aparelho do membro.

-- 1) Regra da janela isolada numa função (facilita testar e ajustar).
--    Retorna: open | wrong_day | too_early | too_late
create or replace function public.self_checkin_window_status(_at timestamptz default now())
returns text
language sql
stable
set search_path = public
as $$
  select case
    when extract(isodow from (_at at time zone 'America/Sao_Paulo')) <> 2 then 'wrong_day'
    when (_at at time zone 'America/Sao_Paulo')::time < time '06:30' then 'too_early'
    when (_at at time zone 'America/Sao_Paulo')::time > time '09:00' then 'too_late'
    else 'open'
  end;
$$;

-- 2) RPC: mesma de antes, agora recusando fora da janela.
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
  v_window text;
  v_group_id uuid;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_distance double precision;
  v_existing double precision;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Só terça-feira, das 06:30 às 09:00 (horário de Brasília).
  v_window := public.self_checkin_window_status(now());
  if v_window <> 'open' then
    return jsonb_build_object(
      'status', 'outside_window',
      'reason', v_window,
      'max_distance_m', c_max_distance_m
    );
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
