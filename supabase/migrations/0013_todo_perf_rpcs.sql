-- Performance RPCs for todo create/delete and app-shell counts.

create or replace function public.create_todo_fast(
  p_title text,
  p_list_id uuid default null,
  p_parent_id uuid default null
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_title text := trim(coalesce(p_title, ''));
  v_effective_list_id uuid := p_list_id;
  v_plan_type text := 'free';
  v_subscription_status text := 'inactive';
  v_is_pro boolean := false;
  v_total_active integer := 0;
  v_list_active integer := 0;
  v_parent_parent_id uuid;
  v_next_all_position integer := 0;
  v_next_list_position integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not signed in.';
  end if;

  if v_title = '' then
    raise exception 'Enter a task title.';
  end if;

  select us.plan_type, us.subscription_status
  into v_plan_type, v_subscription_status
  from public.user_subscriptions us
  where us.user_id = v_user_id
  limit 1;

  v_is_pro := v_plan_type = 'lifetime'
    or (v_plan_type in ('monthly', 'yearly') and v_subscription_status = 'active');

  if not v_is_pro then
    select count(*)::int
    into v_total_active
    from public.todos t
    where t.user_id = v_user_id
      and coalesce(t.is_completed, false) = false;

    if v_total_active >= 25 then
      raise exception 'You''ve reached the 25 active todo limit on the free plan. Upgrade to add more.';
    end if;
  end if;

  if p_parent_id is not null then
    select t.list_id, t.parent_id
    into v_effective_list_id, v_parent_parent_id
    from public.todos t
    where t.id = p_parent_id
      and t.user_id = v_user_id
    limit 1;

    if v_effective_list_id is null and v_parent_parent_id is null then
      if not exists (
        select 1
        from public.todos t
        where t.id = p_parent_id and t.user_id = v_user_id
      ) then
        raise exception 'Invalid parent todo.';
      end if;
    end if;

    if v_parent_parent_id is not null then
      raise exception 'Nested sub-todos are not supported.';
    end if;
  end if;

  if v_effective_list_id is not null then
    if not exists (
      select 1
      from public.lists l
      where l.id = v_effective_list_id
        and l.user_id = v_user_id
    ) then
      raise exception 'Invalid list.';
    end if;

    if not v_is_pro then
      select count(*)::int
      into v_list_active
      from public.todos t
      where t.user_id = v_user_id
        and t.list_id = v_effective_list_id
        and coalesce(t.is_completed, false) = false;

      if v_list_active >= 10 then
        raise exception 'This list is full (10/10). Upgrade to add more todos.';
      end if;
    end if;
  end if;

  select coalesce(min(t.all_position), 0) - 1
  into v_next_all_position
  from public.todos t
  where t.user_id = v_user_id;

  if p_parent_id is not null then
    select coalesce(min(t.position), 0) - 1
    into v_next_list_position
    from public.todos t
    where t.user_id = v_user_id
      and t.parent_id = p_parent_id;
  else
    select coalesce(min(t.position), 0) - 1
    into v_next_list_position
    from public.todos t
    where t.user_id = v_user_id
      and t.parent_id is null
      and (
        (v_effective_list_id is null and t.list_id is null)
        or t.list_id = v_effective_list_id
      );
  end if;

  return query
  insert into public.todos (
    user_id,
    title,
    list_id,
    parent_id,
    position,
    all_position
  )
  values (
    v_user_id,
    v_title,
    v_effective_list_id,
    p_parent_id,
    v_next_list_position,
    v_next_all_position
  )
  returning
    todos.id,
    todos.title,
    todos.list_id,
    todos.parent_id,
    coalesce(todos.is_completed, false) as is_completed,
    todos.position,
    todos.all_position;
end;
$$;

create or replace function public.delete_todo_fast(
  p_id uuid
)
returns table (
  id uuid,
  parent_id uuid,
  list_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not signed in.';
  end if;

  return query
  delete from public.todos t
  where t.id = p_id
    and t.user_id = v_user_id
  returning t.id, t.parent_id, t.list_id;

  if not found then
    raise exception 'Todo not found.';
  end if;
end;
$$;

create or replace function public.get_todo_counts_snapshot()
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

grant execute on function public.create_todo_fast(text, uuid, uuid) to authenticated;
grant execute on function public.delete_todo_fast(uuid) to authenticated;
grant execute on function public.get_todo_counts_snapshot() to authenticated;
