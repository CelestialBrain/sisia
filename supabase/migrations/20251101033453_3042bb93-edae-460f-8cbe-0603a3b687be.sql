-- Create function_logs table for persistent function activity logging
create table if not exists public.function_logs (
  id uuid primary key default gen_random_uuid(),
  function_name text not null,
  level text not null check (level in ('info','warn','error','log')),
  event_type text,
  event_message text not null,
  details jsonb,
  user_id uuid,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.function_logs enable row level security;

-- Admins can read logs
create policy "Admins can read function logs"
  on public.function_logs
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Indexes for performance
create index if not exists idx_function_logs_created_at on public.function_logs (created_at desc);
create index if not exists idx_function_logs_function on public.function_logs (function_name);

-- Realtime support
alter table public.function_logs replica identity full;
alter publication supabase_realtime add table public.function_logs;
