-- user_subscriptions: Stripe-backed entitlements per user

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  plan_type text check (plan_type in ('free', 'monthly', 'yearly', 'lifetime')) default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text check (
    subscription_status in ('active', 'canceled', 'past_due', 'trialing', 'inactive')
  ) default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can view own subscription" on public.user_subscriptions;
create policy "Users can view own subscription" on public.user_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Service role can manage subscriptions" on public.user_subscriptions;
create policy "Service role can manage subscriptions" on public.user_subscriptions
  for all using (auth.role() = 'service_role');

-- Backfill existing users with free rows.
insert into public.user_subscriptions (user_id, plan_type, subscription_status)
select u.id, 'free', 'inactive'
from auth.users u
where not exists (
  select 1 from public.user_subscriptions us where us.user_id = u.id
)
on conflict (user_id) do nothing;

-- Extend signup trigger to also create a subscription row.
-- (Replaces definition from 0003_lists_slug_and_defaults.sql)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.lists (user_id, title, slug, position)
  values (new.id, 'Today', 'today', 0);

  insert into public.user_subscriptions (user_id, plan_type, subscription_status)
  values (new.id, 'free', 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

