
-- Drop all existing triggers first to avoid duplicates, then recreate cleanly
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP TRIGGER IF EXISTS on_profile_status_change ON public.profiles;
DROP TRIGGER IF EXISTS on_contribution_inserted ON public.contributions;
DROP TRIGGER IF EXISTS on_contribution_notify ON public.contributions;
DROP TRIGGER IF EXISTS on_contribution_inserted_notify ON public.contributions;
DROP TRIGGER IF EXISTS on_attendance_approved ON public.attendance_sessions;
DROP TRIGGER IF EXISTS on_attendance_session_notify ON public.attendance_sessions;
DROP TRIGGER IF EXISTS update_contributions_updated_at ON public.contributions;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_events_updated_at ON public.events;
DROP TRIGGER IF EXISTS update_groups_updated_at ON public.groups;
DROP TRIGGER IF EXISTS update_discussion_threads_updated_at ON public.discussion_threads;

-- Recreate all triggers (one per function, no duplicates)
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_profile_created_notify();

CREATE TRIGGER on_profile_status_change
  AFTER UPDATE OF status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.on_profile_status_change_notify();

CREATE TRIGGER on_contribution_inserted
  AFTER INSERT ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contribution_inserted();

CREATE TRIGGER on_contribution_notify
  AFTER INSERT ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_contribution_notify();

CREATE TRIGGER on_attendance_approved
  AFTER UPDATE OF status ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_attendance_approved();

CREATE TRIGGER on_attendance_session_notify
  AFTER UPDATE OF status ON public.attendance_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.on_attendance_session_notify();

CREATE TRIGGER update_contributions_updated_at
  BEFORE UPDATE ON public.contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discussion_threads_updated_at
  BEFORE UPDATE ON public.discussion_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
