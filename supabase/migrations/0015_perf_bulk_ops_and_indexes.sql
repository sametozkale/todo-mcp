-- Bulk reorder + duplicate + layout counts fallback + read indexes (todo/list hot paths)

-- ---------------------------------------------------------------------------
-- Bulk reorder: single round-trip, validates full permutation of scope rows
-- ---------------------------------------------------------------------------

create or replace function public.reorder_todos_in_list_positions(p_list_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  expected int;
  got int;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  if not exists (select 1 from public.lists l where l.id = p_list_id and l.user_id = v_uid) then
    raise exception 'Invalid list.';
  end if;

  got := coalesce(array_length(p_ordered_ids, 1), 0);
  if got = 0 then
    return;
  end if;

  select count(*)::int into expected
  from public.todos t
  where t.user_id = v_uid
    and t.list_id = p_list_id
    and t.parent_id is null;

  if expected <> got then
    raise exception 'Invalid todo order.';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) u(id)
    group by id
    having count(*) > 1
  ) then
    raise exception 'Invalid todo order.';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) u(id)
    left join public.todos t on t.id = u.id
    where t.id is null
       or t.user_id <> v_uid
       or t.list_id is distinct from p_list_id
       or t.parent_id is not null
  ) then
    raise exception 'Invalid todo order.';
  end if;

  update public.todos t
  set position = s.idx
  from (
    select u.id, (u.ord - 1)::int as idx
    from unnest(p_ordered_ids) with ordinality as u(id, ord)
  ) s
  where t.id = s.id;
end;
$$;

create or replace function public.reorder_todos_all_positions(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  expected int;
  got int;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  got := coalesce(array_length(p_ordered_ids, 1), 0);
  if got = 0 then
    return;
  end if;

  select count(*)::int into expected
  from public.todos t
  where t.user_id = v_uid
    and t.parent_id is null;

  if expected <> got then
    raise exception 'Invalid todo order.';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) u(id)
    group by id
    having count(*) > 1
  ) then
    raise exception 'Invalid todo order.';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) u(id)
    left join public.todos t on t.id = u.id
    where t.id is null
       or t.user_id <> v_uid
       or t.parent_id is not null
  ) then
    raise exception 'Invalid todo order.';
  end if;

  update public.todos t
  set all_position = s.idx
  from (
    select u.id, (u.ord - 1)::int as idx
    from unnest(p_ordered_ids) with ordinality as u(id, ord)
  ) s
  where t.id = s.id;
end;
$$;

create or replace function public.reorder_sub_todos_positions(p_parent_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  expected int;
  got int;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  if not exists (
    select 1 from public.todos p
    where p.id = p_parent_id and p.user_id = v_uid and p.parent_id is null
  ) then
    raise exception 'Parent todo not found.';
  end if;

  got := coalesce(array_length(p_ordered_ids, 1), 0);
  if got = 0 then
    return;
  end if;

  select count(*)::int into expected
  from public.todos t
  where t.user_id = v_uid
    and t.parent_id = p_parent_id;

  if expected <> got then
    raise exception 'Invalid todo order.';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) u(id)
    group by id
    having count(*) > 1
  ) then
    raise exception 'Invalid todo order.';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) u(id)
    left join public.todos t on t.id = u.id
    where t.id is null
       or t.user_id <> v_uid
       or t.parent_id is distinct from p_parent_id
  ) then
    raise exception 'Invalid todo order.';
  end if;

  update public.todos t
  set position = s.idx
  from (
    select u.id, (u.ord - 1)::int as idx
    from unnest(p_ordered_ids) with ordinality as u(id, ord)
  ) s
  where t.id = s.id;
end;
$$;

create or replace function public.reorder_lists_positions(p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  expected int;
  got int;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  got := coalesce(array_length(p_ordered_ids, 1), 0);
  if got = 0 then
    return;
  end if;

  select count(*)::int into expected
  from public.lists l
  where l.user_id = v_uid;

  if expected <> got then
    raise exception 'Invalid list order.';
  end if;

  if exists (
    select 1 from unnest(p_ordered_ids) u(id)
    group by id
    having count(*) > 1
  ) then
    raise exception 'Invalid list order.';
  end if;

  if exists (
    select 1
    from unnest(p_ordered_ids) u(id)
    left join public.lists l on l.id = u.id
    where l.id is null or l.user_id <> v_uid
  ) then
    raise exception 'Invalid list order.';
  end if;

  update public.lists l
  set position = s.idx
  from (
    select u.id, (u.ord - 1)::int as idx
    from unnest(p_ordered_ids) with ordinality as u(id, ord)
  ) s
  where l.id = s.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Duplicate todo: shift siblings + all_position in one transaction
-- ---------------------------------------------------------------------------

create or replace function public.duplicate_todo_fast(p_source_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  src public.todos%rowtype;
  new_id uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select * into src
  from public.todos
  where id = p_source_id and user_id = v_uid;

  if not found then
    raise exception 'Todo not found.';
  end if;

  if src.parent_id is not null then
    update public.todos
    set position = position + 1
    where user_id = v_uid
      and parent_id = src.parent_id
      and position > coalesce(src.position, 0);
  elsif src.list_id is null then
    update public.todos
    set position = position + 1
    where user_id = v_uid
      and list_id is null
      and parent_id is null
      and position > coalesce(src.position, 0);
  else
    update public.todos
    set position = position + 1
    where user_id = v_uid
      and list_id = src.list_id
      and parent_id is null
      and position > coalesce(src.position, 0);
  end if;

  update public.todos
  set all_position = all_position + 1
  where user_id = v_uid
    and all_position > coalesce(src.all_position, 0);

  insert into public.todos (
    user_id,
    title,
    list_id,
    parent_id,
    is_completed,
    completed_at,
    position,
    all_position
  )
  values (
    v_uid,
    src.title,
    src.list_id,
    src.parent_id,
    src.is_completed,
    src.completed_at,
    coalesce(src.position, 0) + 1,
    coalesce(src.all_position, 0) + 1
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Same aggregates as get_todo_counts_snapshot (single round-trip fallback)
-- ---------------------------------------------------------------------------

create or replace function public.get_todo_counts_layout_fallback()
returns table (
  usage_total_active integer,
  all_list_todos_count integer,
  display_all_top_level integer,
  list_usage_by_list jsonb,
  list_display_by_list jsonb
)
language sql
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as user_id
  ),
  active as (
    select t.*
    from public.todos t
    join me on me.user_id = t.user_id
    where coalesce(t.is_completed, false) = false
  ),
  usage_by_list as (
    select
      a.list_id,
      count(*)::int as c
    from active a
    where a.list_id is not null
    group by a.list_id
  ),
  display_by_list as (
    select
      a.list_id,
      count(*)::int as c
    from active a
    where a.list_id is not null
      and a.parent_id is null
    group by a.list_id
  )
  select
    (select count(*)::int from active) as usage_total_active,
    (
      select count(*)::int
      from active a
      where a.list_id is null
    ) as all_list_todos_count,
    (
      select count(*)::int
      from active a
      where a.parent_id is null
    ) as display_all_top_level,
    (
      select coalesce(jsonb_object_agg(ubl.list_id::text, ubl.c), '{}'::jsonb)
      from usage_by_list ubl
    ) as list_usage_by_list,
    (
      select coalesce(jsonb_object_agg(dbl.list_id::text, dbl.c), '{}'::jsonb)
      from display_by_list dbl
    ) as list_display_by_list;
$$;

grant execute on function public.reorder_todos_in_list_positions(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_todos_all_positions(uuid[]) to authenticated;
grant execute on function public.reorder_sub_todos_positions(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_lists_positions(uuid[]) to authenticated;
grant execute on function public.duplicate_todo_fast(uuid) to authenticated;
grant execute on function public.get_todo_counts_layout_fallback() to authenticated;

-- ---------------------------------------------------------------------------
-- Read path indexes ( btree; no concurrent — runs inside migration txn )
-- ---------------------------------------------------------------------------

create index if not exists todos_user_parent_list_position_idx
  on public.todos (user_id, parent_id, list_id, position);

create index if not exists todos_user_parent_all_position_idx
  on public.todos (user_id, parent_id, all_position);

create index if not exists todos_user_active_partial_idx
  on public.todos (user_id)
  where coalesce(is_completed, false) = false;

create index if not exists todos_user_list_active_parent_idx
  on public.todos (user_id, list_id, parent_id)
  where coalesce(is_completed, false) = false;
