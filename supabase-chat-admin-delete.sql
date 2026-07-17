-- Allow admins (via the site) to delete chat messages
-- Run once in Supabase SQL Editor

drop policy if exists "Public can delete chat" on public.chat_messages;

create policy "Public can delete chat"
  on public.chat_messages for delete
  to anon, authenticated
  using (true);
