-- Homie database schema.
-- Run once in Supabase: SQL Editor > New query > paste > Run.
-- Every table is locked to the signed-in user with row-level security,
-- so even though the public API key is in the app, nobody else can read or write rows.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  category text not null check (category in ('routine', 'reminder', 'restock', 'birthday', 'goal')),
  time time,
  start_date date not null,
  -- {"type":"once"} or {"type":"weekly","days":[1,4],"until":"2027-03-01"} etc. Validated in the app.
  recurrence jsonb not null default '{"type":"once"}',
  add_to_gcal boolean not null default false,
  gcal_event_id text,
  source text not null default 'manual' check (source in ('manual', 'inventory', 'meal_plan', 'gcal')),
  source_ref text,
  target text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per date only when something changed (done, skipped, moved time).
create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  date date not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  time_override time,
  unique (task_id, date)
);

-- ---------------------------------------------------------------------------
-- Kitchen
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('fruit', 'snack', 'dish')),
  name text not null,
  meals text[] not null default '{}',
  preferences text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now()
);

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'snack', 'dinner')),
  food_id uuid references public.foods (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  over_on date,
  restock_task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.restocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  restock_date date not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Finance
-- ---------------------------------------------------------------------------
create table public.expense_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.expense_sessions (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  name text not null,
  paid_on date not null,
  bank text not null,
  category text not null check (category in ('Wants', 'Recurring', 'Needs', 'Savings', 'Credit Card/EMIs')),
  expense_type text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Settings (private: holds the Google Sheet ID so it never sits in the public repo)
-- ---------------------------------------------------------------------------
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  sheet_id text,
  month_gids jsonb not null default '{}',
  gcal_last_sync timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index tasks_user_start_idx on public.tasks (user_id, start_date);
create index task_occurrences_user_date_idx on public.task_occurrences (user_id, date);
create index meal_plan_items_plan_idx on public.meal_plan_items (plan_id);
create index restocks_item_idx on public.restocks (item_id, restock_date);
create index expenses_session_idx on public.expenses (session_id);

-- ---------------------------------------------------------------------------
-- Keep tasks.updated_at current
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security: each row is visible and editable only by its owner.
-- Signed-out visitors (anon) get no access at all.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'tasks', 'task_occurrences', 'foods', 'meal_plans', 'meal_plan_items',
    'inventory_items', 'restocks', 'expense_sessions', 'expenses', 'settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
