-- Lists: slug column, unique per user; default Today list on signup; backfill existing users

-- 1) Add slug (nullable first for backfill)
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS slug text;

-- 2) Backfill slug from title for any existing rows (legacy)
UPDATE public.lists
SET slug = trim(both '-' FROM regexp_replace(
  regexp_replace(lower(trim(title)), '[^a-z0-9]+', '-', 'g'),
  '(^-+|-+$)', '', 'g'
))
WHERE slug IS NULL OR trim(COALESCE(slug, '')) = '';

-- Empty slug after transform → fallback
UPDATE public.lists
SET slug = 'list-' || replace(id::text, '-', '')
WHERE slug IS NULL OR trim(slug) = '';

-- 3) Deduplicate slugs per user (append stable suffix for duplicates after the first)
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY user_id, slug ORDER BY created_at) AS rn
  FROM public.lists
)
UPDATE public.lists l
SET slug = l.slug || '-dup-' || substr(l.id::text, 1, 8)
FROM ranked r
WHERE l.id = r.id AND r.rn > 1;

-- 4) Enforce NOT NULL + unique index
ALTER TABLE public.lists
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS lists_user_id_slug_key ON public.lists (user_id, slug);

-- 5) Today list for existing users who do not have one
INSERT INTO public.lists (user_id, title, slug, position)
SELECT p.id, 'Today', 'today', 0
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.lists l
  WHERE l.user_id = p.id AND l.slug = 'today'
);

-- 6) Attach orphaned todos to that user's Today list
UPDATE public.todos t
SET list_id = l.id
FROM public.lists l
WHERE t.list_id IS NULL
  AND t.user_id = l.user_id
  AND l.slug = 'today';

-- 7) Extend signup: create Today list after profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.lists (user_id, title, slug, position)
  VALUES (NEW.id, 'Today', 'today', 0);
  RETURN NEW;
END;
$$;
