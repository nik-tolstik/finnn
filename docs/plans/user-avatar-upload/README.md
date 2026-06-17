# User Avatar Upload Plan

## Goal

Allow authenticated users to upload a custom profile avatar from their device and store it in the Railway Bucket that is
attached to the API environment.

The feature should preserve the existing preset avatar picker and initial-based default avatar. Uploaded avatars should
appear everywhere `User.image` is already used: session UI, sidebar/menu, workspace members, account owners, transaction
owners, and optimistic cache projections.

The desired agent workflow is:

```text
Orchestrator -> Developer -> Subagents
```

- The Orchestrator gives one complete task prompt.
- The Developer implements the feature end to end.
- Subagents help with bounded investigation, implementation, and verification when they reduce risk or latency.
- The Developer must leave an execution history in this folder as the work progresses.

## Required Work Log

The Developer must update [work-log.md](./work-log.md) after every substantial phase.

Each entry must include:

- Date/time.
- Agent role/name.
- Files changed.
- Commands run.
- Tests/checks result.
- Decisions made.
- Blockers or follow-ups.

If a subagent contributes analysis or a patch, the Developer must summarize that contribution in the work log before
finishing.

## Product Requirements

- Users can choose a local image file as their avatar from profile settings.
- Users can keep choosing existing preset avatars.
- Users can clear their avatar back to the initial-based default.
- Uploaded avatars are visible anywhere the current user image already appears.
- Replacing an uploaded avatar should remove the previous uploaded object from storage when possible.
- Clearing an uploaded avatar should remove the uploaded object from storage when possible.
- Telegram may set `User.image` only when the user currently has no avatar (`User.image === null`).
- Telegram must not overwrite a preset avatar or an uploaded avatar.
- Telegram identity metadata (`AuthIdentity.photoUrl`) should still update whenever Telegram sends a new photo URL.
- Browser screenshot QA must not be run unless explicitly requested.

## Non-Goals For MVP

- Do not build image cropping or editing in the first pass.
- Do not accept SVG or arbitrary document uploads.
- Do not make the Railway Bucket public.
- Do not hand-edit generated OpenAPI or Orval client files.
- Do not replace the current `User.image` display field with a frontend-only avatar model.

## Current Architecture Summary

Backend:

- Auth endpoints live in `packages/api/src/auth/auth.controller.ts`.
- Auth logic lives in `packages/api/src/auth/auth.service.ts`.
- Current user shape is defined in `packages/api/src/auth/auth.dto.ts`.
- Prisma schema is `packages/api/prisma/schema.prisma`.
- `User.image` already exists and is returned by auth/session DTOs.
- `AuthIdentity.photoUrl` already stores Telegram provider photo metadata.
- API tests include `packages/api/test/auth.e2e.test.ts`.
- There is currently no storage/upload service or S3 client.

Frontend:

- Profile settings dialog is `packages/web/src/modules/auth/components/user-settings-dialog/UserSettingsDialog.tsx`.
- The actual profile form is `packages/web/src/modules/auth/components/account-settings/AccountSettings.tsx`.
- Preset avatar picker is `packages/web/src/modules/auth/components/avatar-picker-dialog/AvatarPickerDialog.tsx`.
- Avatar rendering is `packages/web/src/shared/components/UserAvatar.tsx`.
- Preset avatar constants are in `packages/web/src/shared/constants/user-avatars.ts`.
- Profile validation is in `packages/web/src/modules/auth/auth.validations.ts`.
- Session state is in `packages/web/src/shared/lib/api-session-client.tsx`.
- API calls use `packages/web/src/shared/api/http-client.ts`.
- Generated API clients live in `packages/web/src/shared/api/generated` and must not be edited manually.

## Storage Approach

Use Railway Buckets through their S3-compatible API from the NestJS API service.

Recommended package additions for `packages/api`:

```bash
pnpm --filter api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Railway Buckets are private. The API should authenticate to the bucket with Railway-provided variables and should either
redirect clients to short-lived presigned URLs or proxy avatar reads through the backend.

Recommended MVP serving model:

- Store the object key in `User.avatarStorageKey`.
- Store a stable API URL in `User.image`, for example `/auth/users/{userId}/avatar`.
- Add a public read endpoint that redirects to a short-lived presigned URL:
  - `GET /auth/users/:userId/avatar`
  - Returns `302` to a presigned `GetObject` URL when the user has an uploaded avatar.
  - Returns `404` when the user has no uploaded avatar.

This keeps `User.image` stable, avoids expired URLs in persisted user records, and keeps the bucket private.

If the implementation chooses to store a direct bucket URL in `User.image`, it must also handle URL expiry and configure
the frontend image host. The stable API URL approach is preferred.

## Environment Variables

Add backend variables to `packages/api/.env.example`, `docs/development.md`, and `docs/operations.md`:

```env
AVATAR_BUCKET="bucket-name-from-railway"
AVATAR_BUCKET_ACCESS_KEY_ID="access-key-id"
AVATAR_BUCKET_SECRET_ACCESS_KEY="secret-access-key"
AVATAR_BUCKET_REGION="auto"
AVATAR_BUCKET_ENDPOINT="https://storage.railway.app"
AVATAR_BUCKET_FORCE_PATH_STYLE="false"
AVATAR_MAX_BYTES="2097152"
AVATAR_PRESIGNED_URL_TTL_SECONDS="3600"
```

Mapping notes:

- Railway bucket credentials expose `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `REGION`, and `ENDPOINT`.
- Use project-specific variable references in Railway and map them into the `AVATAR_BUCKET_*` names for clarity.
- Some old buckets may require path-style URLs. Keep `AVATAR_BUCKET_FORCE_PATH_STYLE` configurable.

## Local Development Behavior

`pnpm dev` starts the API and web app as separate services:

- API: `http://localhost:4000`
- Web: `http://localhost:3000`

Avatar upload should work locally against the same S3-compatible Railway Bucket API, as long as `packages/api/.env`
contains the `AVATAR_BUCKET_*` variables. Use a dedicated development bucket or development folder prefix if production
avatar data must stay isolated.

Local upload flow:

1. The browser opens profile settings on `localhost:3000`.
2. The frontend posts `FormData` to `http://localhost:4000/auth/user/avatar` with `credentials: "include"`.
3. The existing API CORS configuration allows the frontend origin when `API_ALLOWED_ORIGINS` includes
   `http://localhost:3000`.
4. The API uploads the file to Railway Bucket and updates `User.image` plus `User.avatarStorageKey`.
5. The frontend refreshes the session query and shows the returned avatar image.

If bucket variables are missing locally, the upload endpoint should fail with a controlled service-unavailable API error
instead of pretending upload succeeded.

For rendering uploaded avatars in local dev, avoid persisting a web-relative URL that points at the wrong service. Either:

- store an absolute API URL such as `http://localhost:4000/auth/users/{userId}/avatar` in local/dev responses, derived
  from an API public base URL env var; or
- store a stable API path such as `/auth/users/{userId}/avatar` and have the frontend resolve avatar paths through
  `NEXT_PUBLIC_API_URL` before passing them to the image element.

The second option keeps persisted values environment-neutral and is preferred if implemented carefully.

Because `UserAvatar` currently uses `next/image`, rendering absolute API or bucket URLs may require `images.remotePatterns`
for local API and deployed API hosts. A simpler alternative is to render user-provided avatar URLs with a normal `img`
inside `UserAvatar`, while keeping preset public SVG avatars on `next/image`.

## Data Model Plan

Update `User` in `packages/api/prisma/schema.prisma`:

```prisma
model User {
  id               String  @id @default(auto()) @map("_id") @db.ObjectId
  email            String?
  name             String?
  image            String?
  avatarStorageKey String?
  // existing fields...
}
```

Do not add an enum for avatar source in the first pass unless it proves necessary. The source can be inferred safely:

- `image === null` means default initial avatar.
- `avatarStorageKey !== null` means uploaded avatar.
- `image` starting with `/avatars/` means preset avatar.
- external Telegram URLs can still exist for users created before this feature or users whose image was filled while
  empty by Telegram.

If future features need richer avatar provenance, add `avatarSource` later.

Run after schema changes:

```bash
pnpm db:generate
pnpm db:push
```

Use `pnpm db:push` only when applying schema/index changes to a real MongoDB environment.

## API Design

Add DTOs under `packages/api/src/auth/auth.dto.ts`:

- `UploadUserAvatarDto` for Swagger multipart schema.
- Optional `UpdateUserAvatarDto` if preset selection is split from `PATCH /auth/user`.

Suggested endpoints in `packages/api/src/auth/auth.controller.ts`:

- `POST /auth/user/avatar`
  - Guard: `AuthGuard`.
  - Content type: `multipart/form-data`.
  - Field: `file`.
  - Response: `AuthUserResponseDto`.
  - Operation ID: `uploadUserAvatar`.

- `DELETE /auth/user/avatar`
  - Guard: `AuthGuard`.
  - Clears uploaded or selected avatar.
  - Deletes old uploaded object when `avatarStorageKey` is set.
  - Response: `AuthUserResponseDto`.
  - Operation ID: `deleteUserAvatar`.

- `GET /auth/users/:userId/avatar`
  - Public read endpoint for uploaded avatars.
  - Redirects to a presigned URL for the stored object.
  - Operation ID: `getUserAvatar`.

Keep `PATCH /auth/user` for profile settings, but fix its current patch semantics:

- Missing `image` must not clear the avatar.
- `image: null` may clear the avatar, but it should route through the same cleanup logic as `DELETE /auth/user/avatar`.
- Preset avatar values should be validated server-side against the existing preset path list or a shared allowlist.

## Backend Implementation Notes

Add a storage service, for example:

- `packages/api/src/avatar/avatar-storage.service.ts`
- `packages/api/src/avatar/avatar.module.ts`

Responsibilities:

- Build an `S3Client` from `AVATAR_BUCKET_*` variables.
- Upload objects with `PutObjectCommand`.
- Delete objects with `DeleteObjectCommand`.
- Generate read URLs with `GetObjectCommand` and `getSignedUrl`.
- Generate storage keys server-side, never from the original filename.
- Return controlled `ServiceUnavailableException` errors when storage is not configured or unavailable.

Validation:

- Accept only `image/jpeg`, `image/png`, and `image/webp`.
- Default maximum size: 2 MB.
- Reject empty files.
- Prefer checking magic bytes in addition to MIME type if implementation time allows.
- Do not accept SVG.

Replacement flow:

1. Read current user with `id`, `image`, `avatarStorageKey`.
2. Upload new object to bucket.
3. Update user:
   - `image: /auth/users/{userId}/avatar`
   - `avatarStorageKey: newKey`
4. If DB update succeeds, delete the old uploaded object if present.
5. If DB update fails after upload, delete the newly uploaded object best-effort before rethrowing.

Deletion flow:

1. Read current user with `id`, `avatarStorageKey`.
2. Set `image: null`, `avatarStorageKey: null`.
3. Delete old uploaded object best-effort if present.

## Telegram Avatar Rule

Telegram should only fill `User.image` when the user currently has no avatar.

Required behavior:

- New Telegram-created users may get `image = getTelegramPhotoUrl(claims)` during user creation.
- Existing users with `image === null` may get `image = getTelegramPhotoUrl(claims)`.
- Existing users with any non-null `image` must keep their current `image`.
- `AuthIdentity.photoUrl` should update every time Telegram sends a changed photo URL.

Implementation target:

- Update the existing Telegram identity sync path in `packages/api/src/auth/auth.service.ts`.
- Add or update API tests to lock this behavior.

## Frontend Design

Update `AvatarPickerDialog`:

- Add an upload section above the default/preset avatar sections.
- Use a hidden file input:

```tsx
<input type="file" accept="image/png,image/jpeg,image/webp" />
```

- Show a preview with `URL.createObjectURL(file)`.
- Revoke object URLs when replaced or when the dialog unmounts.
- Show pending state while upload is running.
- Show inline errors for invalid type, invalid size, and API failures.
- Keep the dialog open during upload.
- Close the dialog after a successful upload or preset/default selection.

Update `AccountSettings`:

- Keep using `setValue("image", ...)` so existing dirty state and optimistic cache updates continue to work.
- After upload success, call `updateSession()` and update form state with the returned `result.user.image`.
- Keep existing preset avatar selection.

API wrapper:

- Orval may generate a multipart helper after `pnpm api:generate`.
- If true upload progress is required, add a small `XMLHttpRequest` wrapper in the auth module because browser `fetch`
  does not expose upload progress.
- For MVP, pending state without percentage is acceptable.

Update validation:

- `updateUserSchema` should allow:
  - `null`
  - existing preset paths from `USER_AVATARS`
  - stable API avatar URLs such as `/auth/users/{userId}/avatar`

Update `next.config.ts` only if external avatar URLs are rendered through `next/image`. The preferred stable API URL is
same-origin to the API, so it may still require either `remotePatterns` for the API host or a switch to a regular `img`
tag for avatar URLs.

## Service Worker Notes

Do not cache financial documents, API responses, dashboard routes, or data responses.

If uploaded avatars are served through the API host, the web service worker should not cache them because the API host is
outside the web origin. If a same-origin avatar route is later added to the web app, make sure uploaded avatar URLs are
versioned or excluded from static image caching.

## OpenAPI And Generated Client

After API contract changes:

```bash
pnpm api:generate
pnpm api:check-generated
```

Do not edit generated files manually:

- `packages/api/openapi.json`
- `packages/web/src/shared/api/generated/**`

## Test Plan

Backend targeted tests in `packages/api/test/auth.e2e.test.ts`:

- `POST /auth/user/avatar` requires authentication.
- Valid PNG/JPEG/WebP upload stores object, updates `User.image`, and returns `AuthUserResponseDto`.
- Missing file is rejected.
- Empty file is rejected.
- Invalid MIME type is rejected.
- Oversized file is rejected.
- Storage upload failure does not update the database.
- DB update failure after upload deletes the newly uploaded object best-effort.
- Replacing an uploaded avatar deletes the previous uploaded object best-effort.
- `DELETE /auth/user/avatar` clears `image` and `avatarStorageKey`.
- Telegram fills `User.image` only when it is currently `null`.
- Telegram does not overwrite preset or uploaded avatar values.
- Telegram still updates `AuthIdentity.photoUrl`.

Frontend targeted tests:

- `updateUserSchema` accepts `null`, preset paths, and stable API avatar URLs.
- `updateUserSchema` rejects arbitrary URL/string values.
- Upload wrapper sends `FormData` without manually setting `Content-Type`.
- Upload wrapper uses credentials.
- Avatar picker validates file type and size before upload.

Verification commands:

```bash
pnpm api:generate
pnpm api:check-generated
pnpm --filter api typecheck
pnpm --filter api test test/auth.e2e.test.ts
pnpm --filter api check
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web check
```

For non-trivial implementation work, also run:

```bash
pnpm typecheck
pnpm check
pnpm test
```

## Documentation Updates

Update these docs when implementing:

- `packages/api/.env.example`
- `docs/development.md`
- `docs/operations.md`
- `docs/domain-model.md` if `avatarStorageKey` is added to the data model description.
- `AGENTS.md` only if avatar upload changes agent-facing conventions.

## Implementation Phases

### Phase 1: Backend Storage Foundation

- Add S3 SDK dependencies to `packages/api`.
- Add avatar storage service/module.
- Add env parsing and clear unavailable-storage errors.
- Add unit coverage if the storage service has meaningful pure logic.

### Phase 2: Data Model And Telegram Rule

- Add `User.avatarStorageKey`.
- Regenerate Prisma client.
- Update auth user selects where needed.
- Update Telegram sync so it only fills empty `User.image`.
- Add API tests for the Telegram avatar rule.

### Phase 3: Upload/Delete/Serve API

- Add multipart upload endpoint with Swagger metadata.
- Add delete endpoint.
- Add avatar redirect endpoint.
- Add storage cleanup behavior.
- Add auth e2e tests.

### Phase 4: Frontend Upload UI

- Add upload UI to `AvatarPickerDialog`.
- Add or use generated upload API function.
- Update validation.
- Refresh session and cache after upload/delete.
- Add frontend tests for validation and upload wrapper.

### Phase 5: Generated Clients, Docs, Verification

- Run `pnpm api:generate`.
- Update docs and env examples.
- Run targeted checks, then broader `pnpm typecheck`, `pnpm check`, and `pnpm test` if feasible.
- Update this plan's work log with commands, results, and any remaining follow-ups.
