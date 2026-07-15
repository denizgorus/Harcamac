create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60), color text not null default '#3f8f74',
  kind text not null check (kind in ('income','expense')), one_time boolean not null default true,
  recurring boolean not null default false, created_at timestamptz not null default now(), unique(user_id, name, kind)
);
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100), category_id uuid references public.categories(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0), kind text not null check (kind in ('income','expense')),
  cadence text not null check (cadence in ('one_time','recurring')), entry_date date not null default current_date,
  note text not null default '', installment_count integer check (installment_count is null or installment_count between 2 and 120),
  notification_enabled boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, symbol text not null default '', kind text not null, units numeric(18,6) not null check (units >= 0),
  average_cost numeric(18,4) not null default 0, current_price numeric(18,4) not null default 0,
  purchase_date date, created_at timestamptz not null default now()
);
alter table public.assets add column if not exists purchase_date date;

alter table public.categories enable row level security;
alter table public.entries enable row level security;
alter table public.assets enable row level security;
create policy "categories_own_rows" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries_own_rows" on public.entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "assets_own_rows" on public.assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists entries_user_date_idx on public.entries(user_id, entry_date desc);
create index if not exists categories_user_idx on public.categories(user_id);
create index if not exists assets_user_idx on public.assets(user_id);
