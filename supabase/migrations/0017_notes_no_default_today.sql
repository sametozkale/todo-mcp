-- Notes: no default Today list — only All (+ user-created lists).

UPDATE public.notes n
SET note_list_id = NULL,
    updated_at = NOW()
FROM public.note_lists nl
WHERE n.note_list_id = nl.id
  AND nl.slug = 'today';

DELETE FROM public.note_lists
WHERE slug = 'today';

-- Restore signup handler without default note list (reverts 0016 note_lists insert).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );

  INSERT INTO public.user_subscriptions (user_id, plan_type, subscription_status)
  VALUES (NEW.id, 'free', 'inactive')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
