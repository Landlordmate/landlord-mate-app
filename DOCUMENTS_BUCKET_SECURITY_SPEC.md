# Documents Bucket — Private + Signed URLs

**Status: IMPLEMENTED on production, 22 July 2026.** Kept as a record of what changed
and why, and as the checklist for replicating to staging.

## The problem (now fixed)

The `documents` bucket was **public**. Compliance documents (tenancy agreements, gas
certs, EICRs, tenant ID) were served at permanent, unauthenticated URLs — anyone with
or guessing a URL could fetch a tenant's document forever, with no login.

## Why it wasn't a one-line change

The storage RLS policy only granted read to the file's **owner**:

```
(bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1])
```

Documents live at `{landlord_user_id}/{property_id_or_'landlord'}/{timestamp}.{ext}`,
so `foldername[1]` is the landlord's ID. That meant:

- **Agents had no RLS route to their landlords' documents.** They could only view them
  because the public bucket bypassed RLS entirely.
- **The anonymous share view** likewise had no RLS route.

So flipping the bucket private on its own would have instantly broken document access
for agents and every share link. Hence the ordering below.

## What was done, in order

### 1. Storage policy so agents can read linked landlords' documents ✅

```sql
CREATE POLICY "Agents can read documents for linked landlords"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    JOIN public.users a ON a.id = (select auth.uid())
    WHERE (storage.foldername(name))[1] = p.user_id::text
      AND a.account_type = 'agent'
      AND (p.added_by_agent_id = (select auth.uid())
           OR lower(p.agent_email) = lower(a.email))
  )
);
```

Mirrors the agent→property link logic in `loadAgentData`. If those linking rules
change, this policy must change with them.

### 2. Edge function `get-shared-document-urls` ✅

The anon share view can't sign its own URLs. This function takes `{ share_token }`,
looks up the property with the service role, and returns 300-second signed URLs for
that property's documents only. Unknown/invalid tokens both return 404 with no
explanation, to avoid confirming whether a token exists.

### 3. Frontend switched to signed URLs ✅

All four `getPublicUrl` call sites replaced with a shared `<ViewDocButton>` component
that resolves a URL on click (async), since signed URLs can't be generated
synchronously during render:

| Context | How it resolves |
|---------|-----------------|
| `AgentView` (public share) | edge function, pre-fetched into `sharedDocUrls` |
| Agent property view | `signDocumentUrl` → `createSignedUrl` (needs policy from step 1) |
| Landlord property view | `signDocumentUrl` (owner, already permitted) |
| Landlord property list | `signDocumentUrl` (owner, already permitted) |

Signed URLs work on public buckets too, which is why step 3 was deployed and verified
*before* step 4 — that ordering is deliberate, keep it if you ever redo this.

### 4. Bucket flipped private ✅

```sql
UPDATE storage.buckets SET public = false WHERE id = 'documents';
```

## Verified on production

- Share link loads property + documents ✅
- Clicking View mints a fresh signed URL and the PDF opens ✅ (retested after the flip)
- Old public URL now returns `400 / "Bucket not found"` ✅ — this is the actual fix
- All 10 documents have valid paths, none orphaned by the change ✅

**Not yet verified** (needs a real login, can't be done from a script):
- Landlord opening their own document while signed in
- Agent opening a linked landlord's document
- Agent being denied a *non*-linked landlord's document

## Rollback

If document viewing breaks for signed-in users:

```sql
UPDATE storage.buckets SET public = true WHERE id = 'documents';
```

That restores the old behaviour immediately. The frontend keeps working either way,
since signed URLs are valid on public buckets — so rollback is safe and non-breaking.

## Still to do

- **Replicate steps 1 and 2 to staging** (`arioyurzlzxwyuxtvcsp`). Staging has no real
  documents, so nothing is broken there today, but the environments are out of sync.
- **`logos` bucket is still public.** Low risk (company logos, non-sensitive) and public
  URLs are genuinely useful there for emails and reports. Left deliberately.
- **Leaked password protection cannot be enabled on the Free plan** — Supabase returns:
  *"Configuring leaked password protection via HaveIBeenPwned.org is available on Pro
  Plans and up."* Needs the Supabase Pro upgrade, already on the launch plan for after
  the first real payment clears.
