-- Enable Realtime
begin;
  -- Create notifications table
  create table if not exists public.notifications (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    type text not null, -- 'approval', 'lead', 'import', 'system', 'pricing'
    message text not null,
    read boolean default false,
    user_id uuid references auth.users(id) -- Optional: if null, it's a global notification (or use RLS to filter)
  );

  -- Enable RLS
  alter table public.notifications enable row level security;

  -- Create policies
  -- Allow users to see their own notifications or global ones (user_id is null)
  create policy "Users can view their own notifications"
    on public.notifications for select
    using (auth.uid() = user_id or user_id is null);

  -- Allow users (authenticated) to insert notifications (e.g. system actions triggering notifications)
  -- In a real app, you might restrict this to server-side only, but for client-side triggers:
  create policy "Users can insert notifications"
    on public.notifications for insert
    with check (auth.role() = 'authenticated');

  -- Allow users to update their own notifications (e.g. mark as read)
  create policy "Users can update their own notifications"
    on public.notifications for update
    using (auth.uid() = user_id or user_id is null);

  -- Enable Realtime for notifications
  alter publication supabase_realtime add table public.notifications;
commit;
