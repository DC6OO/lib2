-- Run this once in Supabase Dashboard → SQL Editor → New query → Run

-- 1) Documents metadata table
create table if not exists public.documents (
  id uuid primary key,
  name text not null,
  type text,
  library text not null,
  year text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists documents_library_year_idx
  on public.documents (library, year);

alter table public.documents enable row level security;

-- Allow the publishable key (anon role) to list / add / delete documents
drop policy if exists "Public can read documents" on public.documents;
drop policy if exists "Public can insert documents" on public.documents;
drop policy if exists "Public can delete documents" on public.documents;

create policy "Public can read documents"
  on public.documents for select
  to anon, authenticated
  using (true);

create policy "Public can insert documents"
  on public.documents for insert
  to anon, authenticated
  with check (true);

create policy "Public can delete documents"
  on public.documents for delete
  to anon, authenticated
  using (true);

-- 2) Public storage bucket for uploaded files
insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read library files" on storage.objects;
drop policy if exists "Public can upload library files" on storage.objects;
drop policy if exists "Public can delete library files" on storage.objects;

create policy "Public can read library files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'library-files');

create policy "Public can upload library files"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'library-files');

create policy "Public can delete library files"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'library-files');
