-- Ranking RPC compatibility for string month keys sent by the app.
-- Keep the existing date-based implementations and add text overloads
-- so Supabase RPC resolution works with JSON/string payloads.

create or replace function public.upsert_ranking_points(
  _group_id uuid,
  _month text,
  _member_id uuid,
  _presence integer default 0,
  _tt integer default 0,
  _indication integer default 0,
  _deal integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_ranking_points(
    _member_id := _member_id,
    _group_id := _group_id,
    _month := _month::date,
    _presence := _presence,
    _tt := _tt,
    _indication := _indication,
    _deal := _deal
  );
end;
$$;

create or replace function public.recalculate_ranking_positions(
  _group_id uuid,
  _month text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_ranking_positions(
    _group_id := _group_id,
    _month := _month::date
  );
end;
$$;
