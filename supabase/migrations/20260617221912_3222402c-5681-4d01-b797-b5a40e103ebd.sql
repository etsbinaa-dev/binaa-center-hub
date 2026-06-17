
-- Allow users to delete their own read notifications
CREATE POLICY "users delete own read notifications"
ON public.notifications
FOR DELETE
USING (user_id = auth.uid() AND read = true);

-- Helper to insert a notification for every user
CREATE OR REPLACE FUNCTION public.create_notification(p_type text, p_message text, p_order_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, order_id, type, message)
  SELECT p.id, p_order_id, p_type, p_message
  FROM public.profiles p;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(text, text, uuid) TO authenticated;
