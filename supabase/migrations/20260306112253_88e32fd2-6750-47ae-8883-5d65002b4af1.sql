
-- Drop all triggers first to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_status_changed ON public.profiles;
DROP TRIGGER IF EXISTS on_contribution_inserted ON public.contributions;
DROP TRIGGER IF EXISTS on_contribution_notify ON public.contributions;
DROP TRIGGER IF EXISTS on_attendance_session_updated ON public.attendance_sessions;
DROP TRIGGER IF EXISTS on_attendance_session_notify ON public.attendance_sessions;
DROP TRIGGER IF EXISTS on_discussion_thread_updated ON public.discussion_threads;

-- Also drop any legacy trg_ prefixed triggers
DROP TRIGGER IF EXISTS trg_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS trg_profile_status_changed ON public.profiles;
DROP TRIGGER IF EXISTS trg_contribution_inserted ON public.contributions;
DROP TRIGGER IF EXISTS trg_contribution_notify ON public.contributions;
DROP TRIGGER IF EXISTS trg_attendance_session_updated ON public.attendance_sessions;
DROP TRIGGER IF EXISTS trg_attendance_session_notify ON public.attendance_sessions;
DROP TRIGGER IF EXISTS trg_discussion_thread_updated ON public.discussion_threads;
DROP TRIGGER IF EXISTS trg_attendance_approved ON public.attendance_sessions;

-- Now create all triggers cleanly

-- 1. New profile (pending) → notify superadmins
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_profile_created_notify();

-- 2. Profile status change → notify user (approved/rejected)
CREATE TRIGGER on_profile_status_changed
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_profile_status_change_notify();

-- 3. Contribution inserted → update ranking points
CREATE TRIGGER on_contribution_inserted
  AFTER INSERT ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contribution_inserted();

-- 4. Contribution inserted → send notifications
CREATE TRIGGER on_contribution_notify
  AFTER INSERT ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contribution_notify();

-- 5. Attendance session approved → ranking points
CREATE TRIGGER on_attendance_session_updated
  AFTER UPDATE OF status ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_attendance_approved();

-- 6. Attendance session status → notifications
CREATE TRIGGER on_attendance_session_notify
  AFTER UPDATE OF status ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_attendance_session_notify();

-- 7. Updated_at auto-update for discussion_threads
CREATE TRIGGER on_discussion_thread_updated
  BEFORE UPDATE ON public.discussion_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
