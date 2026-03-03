
-- Function to upsert a monthly_rankings row and add points
CREATE OR REPLACE FUNCTION public.upsert_ranking_points(
  _member_id uuid,
  _group_id uuid,
  _month date,
  _presence integer DEFAULT 0,
  _tt integer DEFAULT 0,
  _indication integer DEFAULT 0,
  _deal integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO monthly_rankings (member_id, group_id, month, presence_points, tt_points, indication_points, deal_points, total_points)
  VALUES (_member_id, _group_id, _month, _presence, _tt, _indication, _deal, _presence + _tt + _indication + _deal)
  ON CONFLICT (member_id, month)
  DO UPDATE SET
    presence_points = monthly_rankings.presence_points + _presence,
    tt_points = monthly_rankings.tt_points + _tt,
    indication_points = monthly_rankings.indication_points + _indication,
    deal_points = monthly_rankings.deal_points + _deal,
    total_points = (monthly_rankings.presence_points + _presence) + (monthly_rankings.tt_points + _tt) + (monthly_rankings.indication_points + _indication) + (monthly_rankings.deal_points + _deal),
    updated_at = now();
END;
$$;

-- Add unique constraint for upsert if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'monthly_rankings_member_month_unique'
  ) THEN
    ALTER TABLE monthly_rankings ADD CONSTRAINT monthly_rankings_member_month_unique UNIQUE (member_id, month);
  END IF;
END $$;

-- Function to recalculate positions for a group/month
CREATE OR REPLACE FUNCTION public.recalculate_ranking_positions(_group_id uuid, _month date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC) as pos
    FROM monthly_rankings
    WHERE group_id = _group_id AND month = _month
  )
  UPDATE monthly_rankings mr
  SET position = ranked.pos
  FROM ranked
  WHERE mr.id = ranked.id;
END;
$$;

-- Trigger function: when attendance_sessions status changes to 'approved'
CREATE OR REPLACE FUNCTION public.on_attendance_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  _month date;
BEGIN
  -- Only fire when status changes to 'approved' and not a test
  IF NEW.status = 'approved' AND OLD.status <> 'approved' AND NEW.is_test = false THEN
    _month := date_trunc('month', NEW.session_date)::date;
    
    FOR rec IN
      SELECT member_id FROM attendance_records
      WHERE session_id = NEW.id AND (status = 'present' OR status = 'substituted')
    LOOP
      PERFORM upsert_ranking_points(rec.member_id, NEW.group_id, _month, 2, 0, 0, 0);
    END LOOP;
    
    PERFORM recalculate_ranking_positions(NEW.group_id, _month);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_approved
  AFTER UPDATE ON attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION on_attendance_approved();

-- Trigger function: when a contribution is inserted
CREATE OR REPLACE FUNCTION public.on_contribution_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _month date;
  _p integer := 0;
  _t integer := 0;
  _i integer := 0;
  _d integer := 0;
BEGIN
  _month := date_trunc('month', NEW.contribution_date)::date;
  
  IF NEW.type = 'one_to_one' THEN
    _t := 2;
  ELSIF NEW.type = 'referral' THEN
    _i := 1;
  ELSIF NEW.type = 'onf' THEN
    _d := 3;
  ELSE
    -- attendance/ueg types: no auto-points from contribution insert
    RETURN NEW;
  END IF;
  
  PERFORM upsert_ranking_points(NEW.user_id, NEW.group_id, _month, _p, _t, _i, _d);
  PERFORM recalculate_ranking_positions(NEW.group_id, _month);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contribution_ranking
  AFTER INSERT ON contributions
  FOR EACH ROW
  EXECUTE FUNCTION on_contribution_inserted();
