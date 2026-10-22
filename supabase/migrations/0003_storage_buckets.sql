-- Migration: Supabase Storage buckets for user-uploaded images
--
-- Creates two public buckets:
--   coin-photos — images attached to LoveCoin records
--   note-photos — images attached to LoveNote records
--
-- Both buckets are public-readable (CDN delivery without auth token).
-- Writes are restricted to authenticated users uploading to their own user-prefixed path.
-- The path format enforced by RLS is: {auth.uid()}/{anything}
-- This matches the generateStoragePath utility: {userId}/{timestamp}-{randomId}.{ext}

-- =============================================================================
-- Create buckets
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('coin-photos', 'coin-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('note-photos', 'note-photos', true)
on conflict (id) do nothing;

-- =============================================================================
-- Storage RLS: coin-photos
-- =============================================================================

-- Public read: anyone (anon or authenticated) can download images from this bucket.
-- This enables direct CDN-style image URLs in <img> tags without an auth header.
create policy "coin-photos public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'coin-photos');

-- Authenticated write to own path only.
-- storage.foldername(name) returns an array of path segments split by '/'.
-- Index [1] (1-based) is the first segment, which must equal the caller's user ID.
-- Example allowed path: "a1b2c3d4-e5f6-7890-abcd-ef1234567890/1719876543210-abc123.jpg"
create policy "coin-photos own upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'coin-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated delete of own files only.
create policy "coin-photos own delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'coin-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Storage RLS: note-photos (same pattern as coin-photos)
-- =============================================================================

create policy "note-photos public read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'note-photos');

create policy "note-photos own upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'note-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "note-photos own delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'note-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
