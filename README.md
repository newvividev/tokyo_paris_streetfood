<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0921448f-9bed-4b83-8a10-06ddbaef767f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure environment values in `.env.local` (copy from `.env.example`):
   - `GEMINI_API_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Run the app:
   `npm run dev`

## Supabase setup

1. Create a Supabase project.
2. Open `Project Settings > API`.
3. Copy URL and anon key into `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET` (example: `ops-media`)
4. Start app with `npm run dev` and login.
5. Check top bar badge:
   - `Supabase Connected` means frontend is connected.
   - `Supabase Missing Env` means env vars are not set.
   - `Supabase Error` means config exists but connection failed.

### Create tables (SQL)

Run this in Supabase SQL editor:

```sql
create table if not exists public.menu_items (
  id text primary key,
  name text not null,
  category text not null default 'Uncategorized',
  price numeric not null default 0,
  cost numeric not null default 0,
  stock integer not null default 0,
  sku text not null default '',
  image text not null default '',
  description text not null default '',
  is_active boolean not null default true
);

alter table public.menu_items
  add column if not exists is_active boolean not null default true;

create table if not exists public.menu_recipes (
  menu_id text not null references public.menu_items(id) on delete cascade,
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  quantity numeric not null default 0,
  primary key (menu_id, ingredient_id)
);

create table if not exists public.orders (
  id text primary key,
  customer text not null default 'Guest',
  items text not null default '',
  total numeric not null default 0,
  status text not null default 'new',
  time text not null default '',
  type text not null default 'dine-in',
  note text null,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id text primary key,
  name text not null,
  role text not null check (role in ('Manager', 'Server', 'Kitchen')),
  image text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  role text primary key check (role in ('Manager', 'Server', 'Kitchen')),
  dashboard_access boolean not null default false,
  kitchen_ops boolean not null default false,
  pos_terminal boolean not null default false,
  inventory_mgmt boolean not null default false,
  staff_permissions boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_accounts (
  staff_id text primary key references public.staff_members(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  must_change_password boolean not null default true,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.ingredients (
  id text primary key,
  name text not null,
  category text not null default 'General',
  unit text not null default 'unit',
  unit_cost numeric not null default 0,
  stock numeric not null default 0,
  image text not null default '',
  created_at timestamptz not null default now()
);

alter table public.ingredients
  add column if not exists category text not null default 'General';

insert into storage.buckets (id, name, public)
values ('ops-media', 'ops-media', true)
on conflict (id) do nothing;

create policy "Public read ops-media"
on storage.objects for select
to public
using (bucket_id = 'ops-media');

create policy "Public upload ops-media"
on storage.objects for insert
to public
with check (bucket_id = 'ops-media');

create policy "Public update ops-media"
on storage.objects for update
to public
using (bucket_id = 'ops-media')
with check (bucket_id = 'ops-media');
```

## Deploy to Cloudflare Pages

### Option A: Deploy via Cloudflare Dashboard (recommended)

1. Push this repo to GitHub.
2. In Cloudflare: `Workers & Pages` > `Create` > `Pages` > `Connect to Git`.
3. Select this repository and use:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add Environment Variables in Pages project settings (both Preview and Production):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_SUPABASE_STORAGE_BUCKET` (example: `ops-media`)
5. Re-deploy after saving env vars.

### Option B: Deploy from CLI

1. Login to Cloudflare:
   `npx wrangler login`
2. Build app:
   `npm run build`
3. Deploy:
   `npm run deploy:pages -- --project-name <your-pages-project-name>`

### Local preview with Pages runtime

- Build first: `npm run build`
- Preview: `npm run preview:pages`
