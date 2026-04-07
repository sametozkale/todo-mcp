-- Compatibility wrapper for PostgREST schema-cache signature resolution.
-- Supports argument order: (p_list_id, p_parent_id, p_title)
-- while keeping the original implementation signature.

create or replace function public.create_todo_fast(
  p_list_id uuid,
  p_parent_id uuid,
  p_title text
)
returns table (
  id uuid,
  title text,
  list_id uuid,
  parent_id uuid,
  is_completed boolean,
  position integer,
  all_position integer
)
language sql
security definer
set search_path = public
as $$
  select *
  from public.create_todo_fast(
    p_title => p_title,
    p_list_id => p_list_id,
    p_parent_id => p_parent_id
  );
$$;

grant execute on function public.create_todo_fast(uuid, uuid, text) to authenticated;
