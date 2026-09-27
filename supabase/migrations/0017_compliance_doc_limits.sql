-- =============================================================================
-- IslaPabili MVP v1.0 - 0017: Compliance document upload limits
-- The rider app rejects a document over 3 MB before it is sent. The bucket
-- enforces the same ceiling server-side, so the limit holds even if the client
-- is bypassed, and non-image payloads are refused outright.
-- =============================================================================
update storage.buckets
set
  file_size_limit = 3145728, -- 3 MB, matches MAX_DOC_BYTES in RiderApplicationScreen
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
where id = 'onboarding-docs';
