-- "All" aggregate view uses `all_position`; each list view uses `position` within that list only.

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS all_position INTEGER;

COMMENT ON COLUMN public.todos.all_position IS 'Sort order for /all; independent of per-list position.';

-- Preserve previous All-page ordering (was: position, then created_at).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY position ASC NULLS FIRST, created_at DESC
    ) - 1 AS ap
  FROM public.todos
)
UPDATE public.todos t
SET all_position = ranked.ap
FROM ranked
WHERE t.id = ranked.id;
