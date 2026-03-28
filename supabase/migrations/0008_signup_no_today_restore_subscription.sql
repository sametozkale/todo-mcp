-- New signups: profile + free subscription row only. No default "Today" list — All uses
-- todos with list_id IS NULL (see 0007). Re-adds user_subscriptions insert that 0007 dropped.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_subscriptions (user_id, plan_type, subscription_status)
  VALUES (NEW.id, 'free', 'inactive')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Legacy: empty auto-style "Today" lists block free users from creating their one allowed list.
DELETE FROM public.lists l
WHERE l.slug = 'today'
  AND l.title = 'Today'
  AND NOT EXISTS (
    SELECT 1 FROM public.todos t WHERE t.list_id = l.id
  );
