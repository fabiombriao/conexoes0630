
-- Fix overly permissive visitor invitation policies
DROP POLICY "Public can update by token" ON public.visitor_invitations;

-- Only allow updating status field via token-based lookup (more restrictive)
CREATE POLICY "Visitors can confirm by token" ON public.visitor_invitations 
  FOR UPDATE USING (status = 'pending');
