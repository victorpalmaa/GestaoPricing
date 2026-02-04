-- Create notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  type text not null, -- 'approval', 'lead', 'import', 'system', etc.
  message text not null,
  read boolean default false,
  user_id uuid references auth.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.notifications enable row level security;

-- Policy to allow users to view their own notifications
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Policy to allow users to insert notifications (for system actions triggered by them)
create policy "Users can insert notifications"
  on public.notifications for insert
  with check (true); 
  -- Note: Ideally we might want to restrict this, but for now 'true' allows the app to insert 
  -- notifications for other users (e.g. admin notifying user) or self.
  -- If strict security is needed, we might need a server-side function.

-- Policy to allow users to update their own notifications (mark as read)
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

-- Enable realtime
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
