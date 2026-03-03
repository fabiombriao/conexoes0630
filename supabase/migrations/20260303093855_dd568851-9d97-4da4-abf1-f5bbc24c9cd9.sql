
-- Enum types
CREATE TYPE public.app_role AS ENUM ('member', 'group_leader', 'admin');
CREATE TYPE public.contribution_type AS ENUM ('referral', 'onf', 'one_to_one', 'ueg', 'attendance');
CREATE TYPE public.referral_temperature AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE public.referral_action AS ENUM ('called', 'scheduled', 'email', 'in_person');
CREATE TYPE public.referral_status AS ENUM ('new', 'pending', 'closed_won', 'closed_lost');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'substituted');
CREATE TYPE public.ueg_type AS ENUM ('article', 'podcast', 'book', 'msp_training', 'event', 'video');
CREATE TYPE public.event_type AS ENUM ('weekly_meeting', 'regional_event', 'training', 'guest_day', 'business_round');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'confirmed', 'declined');

-- Groups / Chapters
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  professional_title TEXT,
  company_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  business_category TEXT,
  gains_goals TEXT,
  gains_accomplishments TEXT,
  gains_interests TEXT,
  gains_networks TEXT,
  gains_skills TEXT,
  keywords TEXT[] DEFAULT '{}',
  linkedin_url TEXT,
  instagram_url TEXT,
  whatsapp TEXT,
  website_url TEXT,
  video_url TEXT,
  vcr_score NUMERIC DEFAULT 0,
  profile_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'member',
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Group members
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Contributions (PALMS - all types)
CREATE TABLE public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  type contribution_type NOT NULL,
  contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Referral fields
  referred_to UUID REFERENCES auth.users(id),
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  referral_category TEXT,
  temperature referral_temperature,
  referral_action referral_action,
  referral_description TEXT,
  referral_status referral_status DEFAULT 'new',

  -- ONF fields
  related_referral_id UUID REFERENCES public.contributions(id),
  business_value NUMERIC,
  is_repeat_business BOOLEAN DEFAULT false,
  closing_date DATE,

  -- 1-2-1 fields
  meeting_member_id UUID REFERENCES auth.users(id),
  meeting_location TEXT,
  meeting_topics TEXT[],

  -- UEG fields
  ueg_type ueg_type,
  ueg_title TEXT,
  ueg_url TEXT,
  ueg_points INTEGER,
  completion_date DATE,

  -- Attendance fields
  meeting_date DATE,
  attendance_status attendance_status,
  substitute_name TEXT
);
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type event_type NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  capacity INTEGER,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Event registrations
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Visitor invitations
CREATE TABLE public.visitor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  visitor_name TEXT NOT NULL,
  visitor_email TEXT,
  visitor_whatsapp TEXT,
  visitor_profession TEXT,
  event_date DATE NOT NULL,
  invite_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visitor_invitations ENABLE ROW LEVEL SECURITY;

-- Discussion threads
CREATE TABLE public.discussion_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;

-- Discussion replies
CREATE TABLE public.discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.discussion_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's group id
CREATE OR REPLACE FUNCTION public.get_user_group_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT group_id FROM public.group_members WHERE user_id = _user_id LIMIT 1
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contributions_updated_at BEFORE UPDATE ON public.contributions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON public.discussion_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users can read all profiles in their group, update own
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can read group member profiles" ON public.profiles FOR SELECT USING (
  id IN (SELECT user_id FROM public.group_members WHERE group_id = public.get_user_group_id(auth.uid()))
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles: users can read own roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Groups: members can read their group
CREATE POLICY "Members can read their group" ON public.groups FOR SELECT USING (
  id = public.get_user_group_id(auth.uid())
);
CREATE POLICY "Admins can manage groups" ON public.groups FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Group members: members can read their group members
CREATE POLICY "Members can read group members" ON public.group_members FOR SELECT USING (
  group_id = public.get_user_group_id(auth.uid())
);
CREATE POLICY "Admins can manage group members" ON public.group_members FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Contributions: members can CRUD own, read group
CREATE POLICY "Users can read own contributions" ON public.contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read group contributions" ON public.contributions FOR SELECT USING (
  group_id = public.get_user_group_id(auth.uid())
);
CREATE POLICY "Users can insert own contributions" ON public.contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contributions" ON public.contributions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contributions" ON public.contributions FOR DELETE USING (auth.uid() = user_id);

-- Events: group members can read, admins/leaders can manage
CREATE POLICY "Members can read group events" ON public.events FOR SELECT USING (
  group_id = public.get_user_group_id(auth.uid())
);
CREATE POLICY "Leaders can manage events" ON public.events FOR ALL USING (
  public.has_role(auth.uid(), 'group_leader') OR public.has_role(auth.uid(), 'admin')
);

-- Event registrations: members can manage own
CREATE POLICY "Users can read own registrations" ON public.event_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can register for events" ON public.event_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can cancel registrations" ON public.event_registrations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all registrations" ON public.event_registrations FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'group_leader')
);

-- Visitor invitations: members can manage own invites
CREATE POLICY "Users can read own invitations" ON public.visitor_invitations FOR SELECT USING (auth.uid() = invited_by);
CREATE POLICY "Users can create invitations" ON public.visitor_invitations FOR INSERT WITH CHECK (auth.uid() = invited_by);
CREATE POLICY "Group can read invitations" ON public.visitor_invitations FOR SELECT USING (
  group_id = public.get_user_group_id(auth.uid())
);
-- Public access for RSVP (by token)
CREATE POLICY "Public can read by token" ON public.visitor_invitations FOR SELECT USING (true);
CREATE POLICY "Public can update by token" ON public.visitor_invitations FOR UPDATE USING (true);

-- Discussion threads: group members can read/write
CREATE POLICY "Members can read group threads" ON public.discussion_threads FOR SELECT USING (
  group_id = public.get_user_group_id(auth.uid())
);
CREATE POLICY "Members can create threads" ON public.discussion_threads FOR INSERT WITH CHECK (
  auth.uid() = author_id AND group_id = public.get_user_group_id(auth.uid())
);
CREATE POLICY "Authors can update threads" ON public.discussion_threads FOR UPDATE USING (auth.uid() = author_id);

-- Discussion replies
CREATE POLICY "Members can read replies" ON public.discussion_replies FOR SELECT USING (
  thread_id IN (SELECT id FROM public.discussion_threads WHERE group_id = public.get_user_group_id(auth.uid()))
);
CREATE POLICY "Members can create replies" ON public.discussion_replies FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Notifications: users can read/update own
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage bucket for forum attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);
CREATE POLICY "Anyone can view attachments" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'attachments' AND auth.uid() IS NOT NULL
);
