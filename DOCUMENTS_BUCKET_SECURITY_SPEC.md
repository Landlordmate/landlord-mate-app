# Documents Bucket — Lock Down to Private + Signed URLs

*Spec written 22 July 2026. Not yet implemented. Requires an active Supabase connection.*

## The problem

The `documents` storage bucket is **public**. Compliance documents (tenancy
agreements, gas certs, EICRs, tenant ID) are served at permanent, unauthenticated
URLs. Anyone who has or guesses a URL can fetch a tenant's document forever, with
no login. File paths are not listable (that policy was removed), which limits
discovery — but it does not fix the underlying exposure.

## Why this is not a one-line change

The current storage RLS policy on `storage.objects` only grants read to the file's
**owner**:

```
(bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1])
```

Documents are stored at `{landlord_user_id}/{property_id}/{timestamp}.{ext}`, so
`foldername[1]` is the landlord's ID. That means:

- **Agents cannot read their landlords' documents under RLS at all.** Today they
  can only view them because the public bucket URL bypasses RLS entirely.
- **The public share view** (`AgentView`, anon user) likewise has no RLS route to
  the files.

So flipping the bucket to private *without* the work below instantly breaks
document viewing for agents and for every share link.

## Required order of operations

Do these in sequence. Do not flip the bucket until steps 1–3 are deployed and verified.

### 1. Add a storage policy so agents can read their landlords' documents

```sql
CREATE POLICY "Agents can read documents for their landlords' properties"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1
    FROM public.properties p
    JOIN public.users a ON a.id = (select auth.uid())
    WHERE (storage.foldername(name))[1] = p.user_id::text
      AND a.account_type = 'agent'
      AND (p.added_by_agent_id = (select auth.uid())
           OR lower(p.agent_email) = lower(a.email))
  )
);
```

Mirrors the existing agent→property link logic in `loadAgentData`
(`agent_email.eq.<email>` OR `added_by_agent_id.eq.<id>`). Verify against that
function if the linking rules change.

### 2. Create an edge function to serve share-link documents

The anon share view cannot sign its own URLs. Needs a `get-shared-document-urls`
edge function that:

- accepts `{ share_token }`
- looks up the property by `share_token` using the **service role** key
- returns short-lived signed URLs (suggest 300s) for that property's documents only
- returns 404 for an unknown/invalid token — never echo back why

Guard against enumeration: rate-limit, and do not leak whether a token exists.

### 3. Switch the frontend to signed URLs

Four call sites currently use `getPublicUrl` for documents in `src/App.js`
(line numbers as of commit `095651b`):

| Line | Context | Replacement |
|------|---------|-------------|
| ~658  | `AgentView` (public share view) | call the edge function from step 2 |
| ~3599 | Agent property view | `createSignedUrl` (works once step 1 lands) |
| ~4860 | Landlord property view | `createSignedUrl` (owner, already permitted) |
| ~5323 | Landlord property list | `createSignedUrl` (owner, already permitted) |

All four are currently a **synchronous** IIFE returning `<a href={publicUrl}>`.
`createSignedUrl` is async, so this needs restructuring — recommend one shared
component:

```jsx
function ViewDocButton({ doc, getUrl }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    const url = await getUrl(doc);       // signed URL or edge-function URL
    setBusy(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else alert('Could not open this document. Please try again.');
  };
  return <button onClick={open} disabled={busy}>{busy ? '…' : '👁 View'}</button>;
}
```

Note: signed URLs work fine on a bucket that is still public, so step 3 can be
deployed and verified **before** step 4. That is the whole point of this ordering.

### 4. Flip the bucket to private

Only after steps 1–3 are live and verified in production:

```sql
UPDATE storage.buckets SET public = false WHERE id = 'documents';
```

### 5. Verify

- Landlord opens own document → works
- Agent opens a linked landlord's document → works
- Agent attempts a *non*-linked landlord's document → denied
- Share link opens documents → works
- Old public URL, logged out → now denied (this is the actual fix)
- Signed URL after expiry → denied

## Related, not covered here

- The `logos` bucket is also public. Much lower risk (company logos, non-sensitive)
  and logos are embedded in emails//reports where public URLs are genuinely useful.
  Leave public unless there's a reason not to.
- Existing documents keep their current paths; no migration of stored files needed.

## Blocked on

Leaked password protection (`HaveIBeenPwned` check) **cannot be enabled on the Free
plan** — confirmed 22 July 2026, Supabase returns:
*"Configuring leaked password protection via HaveIBeenPwned.org is available on Pro
Plans and up."* Requires the Supabase Pro upgrade, which was already on the launch
plan to trigger after first real payment clears.
