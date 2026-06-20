-- Notes UX: user-facing errors say "folder" instead of "list".

CREATE OR REPLACE FUNCTION public.create_note_fast(
  p_title text,
  p_note_list_id uuid DEFAULT NULL,
  p_parent_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  note_list_id uuid,
  parent_id uuid,
  is_completed boolean,
  position integer,
  all_position integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_effective_list_id uuid := p_note_list_id;
  v_plan_type text := 'free';
  v_subscription_status text := 'inactive';
  v_is_pro boolean := false;
  v_total_active integer := 0;
  v_list_active integer := 0;
  v_parent_parent_id uuid;
  v_next_all_position integer := 0;
  v_next_list_position integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'Enter a note title.';
  END IF;

  SELECT us.plan_type, us.subscription_status
  INTO v_plan_type, v_subscription_status
  FROM public.user_subscriptions us
  WHERE us.user_id = v_user_id;

  v_is_pro := (v_plan_type = 'lifetime')
    OR (v_plan_type IN ('monthly', 'yearly') AND v_subscription_status = 'active');

  IF NOT v_is_pro THEN
    SELECT count(*)::int INTO v_total_active
    FROM public.notes n
    WHERE n.user_id = v_user_id
      AND coalesce(n.is_completed, false) = false;

    IF v_total_active >= 25 THEN
      RAISE EXCEPTION 'You''ve reached the 25 active note limit on the free plan. Upgrade to add more.';
    END IF;
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT n.note_list_id, n.parent_id
    INTO v_effective_list_id, v_parent_parent_id
    FROM public.notes n
    WHERE n.id = p_parent_id AND n.user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid parent note.';
    END IF;
    IF v_effective_list_id IS NULL AND v_parent_parent_id IS NULL THEN
      NULL;
    ELSIF v_parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'Nested sub-notes are not supported.';
    END IF;
  END IF;

  IF v_effective_list_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.note_lists nl
      WHERE nl.id = v_effective_list_id
        AND nl.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Invalid folder.';
    END IF;

    IF NOT v_is_pro THEN
      SELECT count(*)::int
      INTO v_list_active
      FROM public.notes n
      WHERE n.user_id = v_user_id
        AND n.note_list_id = v_effective_list_id
        AND coalesce(n.is_completed, false) = false;

      IF v_list_active >= 10 THEN
        RAISE EXCEPTION 'This folder is full (10/10). Upgrade to add more notes.';
      END IF;
    END IF;
  END IF;

  SELECT coalesce(min(n.all_position), 0) - 1
  INTO v_next_all_position
  FROM public.notes n
  WHERE n.user_id = v_user_id;

  IF p_parent_id IS NOT NULL THEN
    SELECT coalesce(min(n.position), 0) - 1
    INTO v_next_list_position
    FROM public.notes n
    WHERE n.user_id = v_user_id AND n.parent_id = p_parent_id;
  ELSE
    SELECT coalesce(min(n.position), 0) - 1
    INTO v_next_list_position
    FROM public.notes n
    WHERE n.user_id = v_user_id
      AND n.parent_id IS NULL
      AND (
        (v_effective_list_id IS NULL AND n.note_list_id IS NULL)
        OR n.note_list_id = v_effective_list_id
      );
  END IF;

  RETURN QUERY
  INSERT INTO public.notes (
    user_id,
    title,
    note_list_id,
    parent_id,
    position,
    all_position
  )
  VALUES (
    v_user_id,
    v_title,
    v_effective_list_id,
    p_parent_id,
    v_next_list_position,
    v_next_all_position
  )
  RETURNING
    notes.id,
    notes.title,
    notes.note_list_id,
    notes.parent_id,
    notes.is_completed,
    notes.position,
    notes.all_position;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_notes_in_list_positions(p_note_list_id uuid, p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  expected int;
  got int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.note_lists nl WHERE nl.id = p_note_list_id AND nl.user_id = v_uid) THEN
    RAISE EXCEPTION 'Invalid folder.';
  END IF;
  SELECT count(*)::int INTO expected
  FROM public.notes n
  WHERE n.user_id = v_uid AND n.note_list_id = p_note_list_id AND n.parent_id IS NULL;
  got := coalesce(array_length(p_ordered_ids, 1), 0);
  IF expected <> got THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) u(id)
    LEFT JOIN public.notes n ON n.id = u.id
    WHERE n.id IS NULL OR n.user_id <> v_uid OR n.note_list_id IS DISTINCT FROM p_note_list_id OR n.parent_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Invalid note order.';
  END IF;
  UPDATE public.notes n SET position = s.idx
  FROM (
    SELECT u.id, (row_number() OVER () - 1)::int AS idx
    FROM unnest(p_ordered_ids) u(id)
  ) s
  WHERE n.id = s.id AND n.user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_note_lists_positions(p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  expected int;
  got int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.'; END IF;
  got := coalesce(array_length(p_ordered_ids, 1), 0);
  SELECT count(*)::int INTO expected FROM public.note_lists nl WHERE nl.user_id = v_uid;
  IF expected <> got THEN RAISE EXCEPTION 'Invalid folder order.'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) u(id)
    LEFT JOIN public.note_lists nl ON nl.id = u.id
    WHERE nl.id IS NULL OR nl.user_id <> v_uid
  ) THEN
    RAISE EXCEPTION 'Invalid folder order.';
  END IF;
  UPDATE public.note_lists nl SET position = s.idx
  FROM (
    SELECT u.id, (row_number() OVER () - 1)::int AS idx
    FROM unnest(p_ordered_ids) u(id)
  ) s
  WHERE nl.id = s.id AND nl.user_id = v_uid;
END;
$$;
