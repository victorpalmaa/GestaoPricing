-- Create notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'approval', 'lead', 'import', 'system', etc.
  message text not null,
  read boolean default false,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies (optional but recommended)
alter table public.notifications enable row level security;

create policy "Users can view all notifications"
  on public.notifications for select
  using (true); -- Or restrict to own notifications: auth.uid() = user_id

create policy "Users can insert notifications"
  on public.notifications for insert
  with check (true);

create policy "Users can update own notifications"
  on public.notifications for update
  using (true);
