-- Run in Supabase SQL Editor (safe to re-run)
-- Adds author_key so people cannot upvote their own messages
-- Also recreates upvote function with self-vote block

alter table public.chat_messages
  add column if not exists author_key text;

update public.chat_messages
set author_key = 'legacy-' || id::text
where author_key is null;

alter table public.chat_messages
  alter column author_key set not null;

drop policy if exists "Public can send chat" on public.chat_messages;

create policy "Public can send chat"
  on public.chat_messages for insert
  to anon, authenticated
  with check (
    char_length(trim(nickname)) between 1 and 40
    and char_length(trim(body)) between 1 and 500
    and char_length(trim(author_key)) between 8 and 80
  );

create or replace function public.upvote_chat_message(p_message_id uuid, p_voter_key text)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.chat_messages;
  updated_row public.chat_messages;
begin
  if p_voter_key is null or char_length(trim(p_voter_key)) < 8 then
    raise exception 'Invalid voter key';
  end if;

  select * into msg
  from public.chat_messages
  where id = p_message_id;

  if msg.id is null then
    raise exception 'Message not found';
  end if;

  if msg.author_key = trim(p_voter_key) then
    raise exception 'You cannot upvote your own message';
  end if;

  insert into public.chat_votes (message_id, voter_key)
  values (p_message_id, trim(p_voter_key));

  update public.chat_messages
  set votes = votes + 1
  where id = p_message_id
  returning * into updated_row;

  return updated_row;
exception
  when unique_violation then
    raise exception 'You already upvoted this message';
end;
$$;

grant execute on function public.upvote_chat_message(uuid, text) to anon, authenticated;
