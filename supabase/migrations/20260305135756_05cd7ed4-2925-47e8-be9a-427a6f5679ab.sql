
-- 1. Create the default group
INSERT INTO public.groups (id, name, description)
VALUES ('00000000-0000-0000-0000-000000000001', 'Conexões 06:30', 'Grupo principal')
ON CONFLICT (id) DO NOTHING;

-- 2. Add ALL existing users (from profiles) to the default group
INSERT INTO public.group_members (user_id, group_id)
SELECT p.id, '00000000-0000-0000-0000-000000000001'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.group_members gm WHERE gm.user_id = p.id
);

-- 3. Update trigger to auto-add new users to the default group
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
  INSERT INTO public.group_members (user_id, group_id)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001');
  RETURN NEW;
END;
$$;
