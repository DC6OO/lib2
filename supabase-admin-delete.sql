-- If you previously ran supabase-admin-delete.sql, run this so
-- password-admin can still delete files (delete button is password-gated in the site).

drop policy if exists "Only authenticated can delete documents" on public.documents;
drop policy if exists "Public can delete documents" on public.documents;

create policy "Public can delete documents"
  on public.documents for delete
  to anon, authenticated
  using (true);

drop policy if exists "Only authenticated can delete library files" on storage.objects;
drop policy if exists "Public can delete library files" on storage.objects;

create policy "Public can delete library files"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'library-files');
