-- Fix profiles SELECT policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read group member profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read group member profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id IN (
    SELECT user_id FROM group_members
    WHERE group_id = get_user_group_id(auth.uid())
  ));

-- Fix group_members SELECT policy: change from RESTRICTIVE to PERMISSIVE
DROP POLICY IF EXISTS "Members can read group members" ON public.group_members;
DROP POLICY IF EXISTS "Admins can manage group members" ON public.group_members;

CREATE POLICY "Members can read group members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

CREATE POLICY "Admins can manage group members"
  ON public.group_members FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix other tables with same issue
-- attendance_records
DROP POLICY IF EXISTS "Members can read group attendance records" ON public.attendance_records;
CREATE POLICY "Members can read group attendance records"
  ON public.attendance_records FOR SELECT
  TO authenticated
  USING (session_id IN (
    SELECT id FROM attendance_sessions
    WHERE group_id = get_user_group_id(auth.uid())
  ));

DROP POLICY IF EXISTS "Admins can insert attendance records" ON public.attendance_records;
CREATE POLICY "Admins can insert attendance records"
  ON public.attendance_records FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update attendance records" ON public.attendance_records;
CREATE POLICY "Admins can update attendance records"
  ON public.attendance_records FOR UPDATE
  TO authenticated
  USING (true);

-- attendance_sessions
DROP POLICY IF EXISTS "Members can read group attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Members can read group attendance sessions"
  ON public.attendance_sessions FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert attendance sessions" ON public.attendance_sessions;
CREATE POLICY "Admins can insert attendance sessions"
  ON public.attendance_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "SuperAdmins can update attendance sessions" ON public.attendance_sessions;
CREATE POLICY "SuperAdmins can update attendance sessions"
  ON public.attendance_sessions FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'group_leader'::app_role));

-- contributions
DROP POLICY IF EXISTS "Users can read group contributions" ON public.contributions;
CREATE POLICY "Users can read group contributions"
  ON public.contributions FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Users can read own contributions" ON public.contributions;
CREATE POLICY "Users can read own contributions"
  ON public.contributions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own contributions" ON public.contributions;
CREATE POLICY "Users can insert own contributions"
  ON public.contributions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own contributions" ON public.contributions;
CREATE POLICY "Users can update own contributions"
  ON public.contributions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own contributions" ON public.contributions;
CREATE POLICY "Users can delete own contributions"
  ON public.contributions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- events
DROP POLICY IF EXISTS "Members can read group events" ON public.events;
CREATE POLICY "Members can read group events"
  ON public.events FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Leaders can manage events" ON public.events;
CREATE POLICY "Leaders can manage events"
  ON public.events FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'group_leader'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- monthly_rankings
DROP POLICY IF EXISTS "Members can read group rankings" ON public.monthly_rankings;
CREATE POLICY "Members can read group rankings"
  ON public.monthly_rankings FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "System can insert rankings" ON public.monthly_rankings;
CREATE POLICY "System can insert rankings"
  ON public.monthly_rankings FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can update rankings" ON public.monthly_rankings;
CREATE POLICY "System can update rankings"
  ON public.monthly_rankings FOR UPDATE
  TO authenticated
  USING (true);

-- visitor_invitations
DROP POLICY IF EXISTS "Group can read invitations" ON public.visitor_invitations;
CREATE POLICY "Group can read invitations"
  ON public.visitor_invitations FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Users can read own invitations" ON public.visitor_invitations;
CREATE POLICY "Users can read own invitations"
  ON public.visitor_invitations FOR SELECT
  TO authenticated
  USING (auth.uid() = invited_by);

DROP POLICY IF EXISTS "Users can create invitations" ON public.visitor_invitations;
CREATE POLICY "Users can create invitations"
  ON public.visitor_invitations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = invited_by);

DROP POLICY IF EXISTS "Public can read by token" ON public.visitor_invitations;
CREATE POLICY "Public can read by token"
  ON public.visitor_invitations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Visitors can confirm by token" ON public.visitor_invitations;
CREATE POLICY "Visitors can confirm by token"
  ON public.visitor_invitations FOR UPDATE
  USING (status = 'pending'::invitation_status);

-- notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- discussion_threads
DROP POLICY IF EXISTS "Members can read group threads" ON public.discussion_threads;
CREATE POLICY "Members can read group threads"
  ON public.discussion_threads FOR SELECT
  TO authenticated
  USING (group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Members can create threads" ON public.discussion_threads;
CREATE POLICY "Members can create threads"
  ON public.discussion_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id AND group_id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Authors can update threads" ON public.discussion_threads;
CREATE POLICY "Authors can update threads"
  ON public.discussion_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

-- discussion_replies
DROP POLICY IF EXISTS "Members can read replies" ON public.discussion_replies;
CREATE POLICY "Members can read replies"
  ON public.discussion_replies FOR SELECT
  TO authenticated
  USING (thread_id IN (
    SELECT id FROM discussion_threads
    WHERE group_id = get_user_group_id(auth.uid())
  ));

DROP POLICY IF EXISTS "Members can create replies" ON public.discussion_replies;
CREATE POLICY "Members can create replies"
  ON public.discussion_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- groups
DROP POLICY IF EXISTS "Members can read their group" ON public.groups;
CREATE POLICY "Members can read their group"
  ON public.groups FOR SELECT
  TO authenticated
  USING (id = get_user_group_id(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "Admins can manage groups"
  ON public.groups FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- user_roles
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- event_registrations
DROP POLICY IF EXISTS "Users can read own registrations" ON public.event_registrations;
CREATE POLICY "Users can read own registrations"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all registrations" ON public.event_registrations;
CREATE POLICY "Admins can read all registrations"
  ON public.event_registrations FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'group_leader'::app_role));

DROP POLICY IF EXISTS "Users can register for events" ON public.event_registrations;
CREATE POLICY "Users can register for events"
  ON public.event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can cancel registrations" ON public.event_registrations;
CREATE POLICY "Users can cancel registrations"
  ON public.event_registrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- profiles INSERT/UPDATE
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);