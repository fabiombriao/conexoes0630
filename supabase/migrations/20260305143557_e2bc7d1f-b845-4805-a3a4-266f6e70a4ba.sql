
-- Recreate all missing triggers

-- 1. Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Trigger for contribution inserted (ranking points)
DROP TRIGGER IF EXISTS on_contribution_inserted ON public.contributions;
CREATE TRIGGER on_contribution_inserted
  AFTER INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.on_contribution_inserted();

-- 3. Trigger for contribution notifications
DROP TRIGGER IF EXISTS on_contribution_notify ON public.contributions;
CREATE TRIGGER on_contribution_notify
  AFTER INSERT ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.on_contribution_notify();

-- 4. Trigger for attendance session status changes
DROP TRIGGER IF EXISTS on_attendance_approved ON public.attendance_sessions;
CREATE TRIGGER on_attendance_approved
  AFTER UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.on_attendance_approved();

-- 5. Trigger for attendance session notifications
DROP TRIGGER IF EXISTS on_attendance_session_notify ON public.attendance_sessions;
CREATE TRIGGER on_attendance_session_notify
  AFTER INSERT OR UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.on_attendance_session_notify();

-- 6. Trigger for profile created (new account notification to superadmins)
DROP TRIGGER IF EXISTS on_profile_created_notify ON public.profiles;
CREATE TRIGGER on_profile_created_notify
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_created_notify();

-- 7. Trigger for profile status change (approved/rejected)
DROP TRIGGER IF EXISTS on_profile_status_change_notify ON public.profiles;
CREATE TRIGGER on_profile_status_change_notify
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.on_profile_status_change_notify();

-- 8. Updated_at triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_contributions_updated_at ON public.contributions;
CREATE TRIGGER update_contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Create a function to broadcast notifications to all active members
CREATE OR REPLACE FUNCTION public.broadcast_notification(_type text, _title text, _message text, _link text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member_id uuid;
BEGIN
  FOR _member_id IN
    SELECT id FROM profiles WHERE status = 'active'
  LOOP
    PERFORM create_notification(_member_id, _type, _title, _message, _link);
  END LOOP;
END;
$$;
