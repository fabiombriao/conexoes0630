
-- Add status and admin_permissions to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_permissions jsonb DEFAULT NULL;

-- Create attendance_session_status enum
DO $$ BEGIN
  CREATE TYPE public.attendance_session_status AS ENUM ('test', 'pending_approval', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create attendance_sessions table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL,
  created_by uuid NOT NULL,
  status attendance_session_status NOT NULL DEFAULT 'pending_approval',
  is_test boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  group_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read group attendance sessions" ON public.attendance_sessions
  FOR SELECT TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

CREATE POLICY "Admins can insert attendance sessions" ON public.attendance_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "SuperAdmins can update attendance sessions" ON public.attendance_sessions
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'group_leader'::app_role));

-- Create attendance_record_status enum
DO $$ BEGIN
  CREATE TYPE public.attendance_record_status AS ENUM ('present', 'absent', 'substituted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create attendance_records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  status attendance_record_status NOT NULL,
  substitute_name text
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read group attendance records" ON public.attendance_records
  FOR SELECT TO authenticated
  USING (session_id IN (SELECT id FROM public.attendance_sessions WHERE group_id = get_user_group_id(auth.uid())));

CREATE POLICY "Admins can insert attendance records" ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update attendance records" ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (true);

-- Create monthly_rankings table
CREATE TABLE IF NOT EXISTS public.monthly_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  member_id uuid NOT NULL,
  group_id uuid NOT NULL,
  presence_points integer NOT NULL DEFAULT 0,
  tt_points integer NOT NULL DEFAULT 0,
  indication_points integer NOT NULL DEFAULT 0,
  deal_points integer NOT NULL DEFAULT 0,
  total_points integer NOT NULL DEFAULT 0,
  position integer,
  is_locked boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, member_id)
);
ALTER TABLE public.monthly_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read group rankings" ON public.monthly_rankings
  FOR SELECT TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

CREATE POLICY "System can insert rankings" ON public.monthly_rankings
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update rankings" ON public.monthly_rankings
  FOR UPDATE TO authenticated
  USING (true);

-- Add whatsapp_opened_at to visitor_invitations
ALTER TABLE public.visitor_invitations ADD COLUMN IF NOT EXISTS whatsapp_opened_at timestamptz DEFAULT NULL;

-- Update handle_new_user to set status = 'pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, status)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'pending');
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;
