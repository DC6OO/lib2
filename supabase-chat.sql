-- Run ALL of this once in Supabase ? SQL Editor ? New query ? Run
-- Creates community chat + upvotes + 7-day cleanup

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  body text not null,
  votes integer not null default 0,
  author_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at);

create index if not exists chat_messages_votes_idx
  on public.chat_messages (votes);

alter table public.chat_messages enable row level security;

drop policy if exists "Public can read chat" on public.chat_messages;
drop policy if exists "Public can send chat" on public.chat_messages;
drop policy if exists "Public can delete chat" on public.chat_messages;

create policy "Public can read chat"
  on public.chat_messages for select
  to anon, authenticated
  using (true);

create policy "Public can send chat"
  on public.chat_messages for insert
  to anon, authenticated
  with check (
    char_length(trim(nickname)) between 1 and 40
    and char_length(trim(body)) between 1 and 500
    and char_length(trim(author_key)) between 8 and 80
  );

create policy "Public can delete chat"
  on public.chat_messages for delete
  to anon, authenticated
  using (true);

-- One vote per browser/device per message
create table if not exists public.chat_votes (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  voter_key text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, voter_key)
);

alter table public.chat_votes enable row level security;

drop policy if exists "Public can read votes" on public.chat_votes;
drop policy if exists "Public can cast votes" on public.chat_votes;

create policy "Public can read votes"
  on public.chat_votes for select
  to anon, authenticated
  using (true);

create policy "Public can cast votes"
  on public.chat_votes for insert
  to anon, authenticated
  with check (char_length(trim(voter_key)) between 8 and 80);

-- Upvote a message (blocks duplicate votes and self-votes)
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

-- Delete 7+ day old messages that have the lowest votes among old messages
create or replace function public.cleanup_low_vote_chat()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
  lowest integer;
begin
  select coalesce(min(votes), 0)
  into lowest
  from public.chat_messages
  where created_at < now() - interval '7 days';

  delete from public.chat_messages
  where created_at < now() - interval '7 days'
    and votes <= lowest;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.cleanup_low_vote_chat() to anon, authenticated;

-- Live updates
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;
