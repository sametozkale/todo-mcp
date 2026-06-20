-- Notes feature: separate note_lists + notes tables (mirror of lists + todos)

CREATE TABLE IF NOT EXISTS public.note_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'list',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS note_lists_user_id_slug_key ON public.note_lists (user_id, slug);

CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  note_list_id UUID REFERENCES public.note_lists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ,
  position INTEGER DEFAULT 0,
  all_position INTEGER,
  parent_id UUID REFERENCES public.notes(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'app',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_completed_notes BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.note_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "note_lists_select_own" ON public.note_lists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "note_lists_insert_own" ON public.note_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "note_lists_update_own" ON public.note_lists FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "note_lists_delete_own" ON public.note_lists FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "notes_select_own" ON public.notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON public.notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON public.notes FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON public.notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Today note list for existing users
INSERT INTO public.note_lists (user_id, title, slug, position)
SELECT p.id, 'Today', 'today', 0
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.note_lists nl
  WHERE nl.user_id = p.id AND nl.slug = 'today'
);

-- Extend signup: create Today note list after profile (todos lists unchanged per 0008)
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

  INSERT INTO public.note_lists (user_id, title, slug, position)
  VALUES (NEW.id, 'Today', 'today', 0);

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Performance RPCs for notes (mirror of todo RPCs)
-- ---------------------------------------------------------------------------

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
  WHERE us.user_id = v_user_id
  LIMIT 1;

  v_is_pro := v_plan_type = 'lifetime'
    OR (v_plan_type IN ('monthly', 'yearly') AND v_subscription_status = 'active');

  IF NOT v_is_pro THEN
    SELECT count(*)::int
    INTO v_total_active
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
    WHERE n.id = p_parent_id
      AND n.user_id = v_user_id
    LIMIT 1;

    IF v_effective_list_id IS NULL AND v_parent_parent_id IS NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.notes n
        WHERE n.id = p_parent_id AND n.user_id = v_user_id
      ) THEN
        RAISE EXCEPTION 'Invalid parent note.';
      END IF;
    END IF;

    IF v_parent_parent_id IS NOT NULL THEN
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
      RAISE EXCEPTION 'Invalid list.';
    END IF;

    IF NOT v_is_pro THEN
      SELECT count(*)::int
      INTO v_list_active
      FROM public.notes n
      WHERE n.user_id = v_user_id
        AND n.note_list_id = v_effective_list_id
        AND coalesce(n.is_completed, false) = false;

      IF v_list_active >= 10 THEN
        RAISE EXCEPTION 'This list is full (10/10). Upgrade to add more notes.';
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
    WHERE n.user_id = v_user_id
      AND n.parent_id = p_parent_id;
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
    coalesce(notes.is_completed, false) AS is_completed,
    notes.position,
    notes.all_position;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_note_fast(p_id uuid)
RETURNS TABLE (id uuid, parent_id uuid, note_list_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;

  RETURN QUERY
  DELETE FROM public.notes n
  WHERE n.id = p_id
    AND n.user_id = v_user_id
  RETURNING n.id, n.parent_id, n.note_list_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_note_counts_snapshot()
RETURNS TABLE (
  usage_total_active integer,
  all_list_notes_count integer,
  display_all_top_level integer,
  list_usage_by_list jsonb,
  list_display_by_list jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS user_id
  ),
  active AS (
    SELECT n.*
    FROM public.notes n
    JOIN me ON me.user_id = n.user_id
    WHERE coalesce(n.is_completed, false) = false
  ),
  usage_by_list AS (
    SELECT
      a.note_list_id,
      count(*)::int AS c
    FROM active a
    WHERE a.note_list_id IS NOT NULL
    GROUP BY a.note_list_id
  ),
  display_by_list AS (
    SELECT
      a.note_list_id,
      count(*)::int AS c
    FROM active a
    WHERE a.note_list_id IS NOT NULL
      AND a.parent_id IS NULL
    GROUP BY a.note_list_id
  )
  SELECT
    (SELECT count(*)::int FROM active) AS usage_total_active,
    (
      SELECT count(*)::int
      FROM active a
      WHERE a.note_list_id IS NULL
    ) AS all_list_notes_count,
    (
      SELECT count(*)::int
      FROM active a
      WHERE a.parent_id IS NULL
    ) AS display_all_top_level,
    (
      SELECT coalesce(jsonb_object_agg(ubl.note_list_id::text, ubl.c), '{}'::jsonb)
      FROM usage_by_list ubl
    ) AS list_usage_by_list,
    (
      SELECT coalesce(jsonb_object_agg(dbl.note_list_id::text, dbl.c), '{}'::jsonb)
      FROM display_by_list dbl
    ) AS list_display_by_list;
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
    RAISE EXCEPTION 'Invalid list.';
  END IF;
  got := coalesce(array_length(p_ordered_ids, 1), 0);
  IF got = 0 THEN RETURN; END IF;
  SELECT count(*)::int INTO expected FROM public.notes n
  WHERE n.user_id = v_uid AND n.note_list_id = p_note_list_id AND n.parent_id IS NULL;
  IF expected <> got THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_ordered_ids) u(id) GROUP BY id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Invalid note order.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) u(id)
    LEFT JOIN public.notes n ON n.id = u.id
    WHERE n.id IS NULL OR n.user_id <> v_uid OR n.note_list_id IS DISTINCT FROM p_note_list_id OR n.parent_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  UPDATE public.notes n SET position = s.idx
  FROM (SELECT u.id, (u.ord - 1)::int AS idx FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, ord)) s
  WHERE n.id = s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_notes_all_positions(p_ordered_ids uuid[])
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
  IF got = 0 THEN RETURN; END IF;
  SELECT count(*)::int INTO expected FROM public.notes n WHERE n.user_id = v_uid AND n.parent_id IS NULL;
  IF expected <> got THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_ordered_ids) u(id) GROUP BY id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Invalid note order.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) u(id)
    LEFT JOIN public.notes n ON n.id = u.id
    WHERE n.id IS NULL OR n.user_id <> v_uid OR n.parent_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  UPDATE public.notes n SET all_position = s.idx
  FROM (SELECT u.id, (u.ord - 1)::int AS idx FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, ord)) s
  WHERE n.id = s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_sub_notes_positions(p_parent_id uuid, p_ordered_ids uuid[])
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
  IF NOT EXISTS (
    SELECT 1 FROM public.notes p WHERE p.id = p_parent_id AND p.user_id = v_uid AND p.parent_id IS NULL
  ) THEN RAISE EXCEPTION 'Parent note not found.'; END IF;
  got := coalesce(array_length(p_ordered_ids, 1), 0);
  IF got = 0 THEN RETURN; END IF;
  SELECT count(*)::int INTO expected FROM public.notes n WHERE n.user_id = v_uid AND n.parent_id = p_parent_id;
  IF expected <> got THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_ordered_ids) u(id) GROUP BY id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Invalid note order.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) u(id)
    LEFT JOIN public.notes n ON n.id = u.id
    WHERE n.id IS NULL OR n.user_id <> v_uid OR n.parent_id IS DISTINCT FROM p_parent_id
  ) THEN RAISE EXCEPTION 'Invalid note order.'; END IF;
  UPDATE public.notes n SET position = s.idx
  FROM (SELECT u.id, (u.ord - 1)::int AS idx FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, ord)) s
  WHERE n.id = s.id;
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
  IF got = 0 THEN RETURN; END IF;
  SELECT count(*)::int INTO expected FROM public.note_lists nl WHERE nl.user_id = v_uid;
  IF expected <> got THEN RAISE EXCEPTION 'Invalid list order.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_ordered_ids) u(id) GROUP BY id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Invalid list order.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_ordered_ids) u(id)
    LEFT JOIN public.note_lists nl ON nl.id = u.id
    WHERE nl.id IS NULL OR nl.user_id <> v_uid
  ) THEN RAISE EXCEPTION 'Invalid list order.'; END IF;
  UPDATE public.note_lists nl SET position = s.idx
  FROM (SELECT u.id, (u.ord - 1)::int AS idx FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, ord)) s
  WHERE nl.id = s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.duplicate_note_fast(p_source_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  src public.notes%rowtype;
  new_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in.'; END IF;
  SELECT * INTO src FROM public.notes WHERE id = p_source_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Note not found.'; END IF;

  IF src.parent_id IS NOT NULL THEN
    UPDATE public.notes SET position = position + 1
    WHERE user_id = v_uid AND parent_id = src.parent_id AND position > coalesce(src.position, 0);
  ELSIF src.note_list_id IS NULL THEN
    UPDATE public.notes SET position = position + 1
    WHERE user_id = v_uid AND note_list_id IS NULL AND parent_id IS NULL AND position > coalesce(src.position, 0);
  ELSE
    UPDATE public.notes SET position = position + 1
    WHERE user_id = v_uid AND note_list_id = src.note_list_id AND parent_id IS NULL AND position > coalesce(src.position, 0);
  END IF;

  UPDATE public.notes SET all_position = all_position + 1
  WHERE user_id = v_uid AND all_position > coalesce(src.all_position, 0);

  INSERT INTO public.notes (user_id, title, note_list_id, parent_id, is_completed, completed_at, position, all_position)
  VALUES (v_uid, src.title, src.note_list_id, src.parent_id, src.is_completed, src.completed_at,
    coalesce(src.position, 0) + 1, coalesce(src.all_position, 0) + 1)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE INDEX IF NOT EXISTS notes_user_parent_list_position_idx
  ON public.notes (user_id, parent_id, note_list_id, position);
CREATE INDEX IF NOT EXISTS notes_user_parent_all_position_idx
  ON public.notes (user_id, parent_id, all_position);
CREATE INDEX IF NOT EXISTS notes_user_active_partial_idx
  ON public.notes (user_id) WHERE coalesce(is_completed, false) = false;
CREATE INDEX IF NOT EXISTS notes_user_list_active_parent_idx
  ON public.notes (user_id, note_list_id, parent_id) WHERE coalesce(is_completed, false) = false;

GRANT EXECUTE ON FUNCTION public.create_note_fast(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_note_fast(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_note_counts_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_notes_in_list_positions(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_notes_all_positions(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_sub_notes_positions(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_note_lists_positions(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_note_fast(uuid) TO authenticated;
