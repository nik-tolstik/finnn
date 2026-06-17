# User Avatar Upload Work Log

This file is the required execution history for the user avatar upload project.

Developer agents must append entries here while implementing the plan in this folder.

## Entry Template

````md
## YYYY-MM-DD HH:mm TZ - Agent Name / Role

### Scope

- What this entry covers.

### Files Changed

- `path/to/file`

### Commands Run

```bash
pnpm ...
```

### Results

- Pass/fail output summary.

### Decisions

- Decision and reason.

### Subagent Contributions

- Agent name: summary of analysis or patch.

### Blockers / Follow-ups

- None, or concrete next action.
````

## 2026-06-17 15:08 +03 - Codex / Planning

### Scope

- Investigated the existing user avatar/auth/session architecture.
- Created the initial implementation plan for custom user avatar uploads backed by Railway Bucket storage.
- Captured the Telegram avatar rule: Telegram may fill `User.image` only when the user currently has no avatar.
- Documented how avatar upload should work under local `pnpm dev`.
- Created this work log so future Developer agents can leave execution history.

### Files Changed

- `docs/plans/user-avatar-upload/README.md`
- `docs/plans/user-avatar-upload/work-log.md`
- `docs/plans/user-avatar-upload/prompt.md`

### Commands Run

```bash
find docs/plans -maxdepth 2 -type f | sort
sed -n '1,220p' docs/plans/telegram-auth/README.md
sed -n '1,180p' docs/plans/telegram-auth/work-log.md
sed -n '1,180p' docs/plans/telegram-mini-app/README.md
mkdir -p docs/plans/user-avatar-upload
apply_patch
date '+%Y-%m-%d %H:%M %Z'
```

### Results

- Existing plan format reviewed.
- New planning folder created.
- Implementation not started.

### Decisions

- Reuse existing `User.image` as the display avatar field.
- Add `User.avatarStorageKey` for reliable cleanup of uploaded objects.
- Prefer storing a stable API avatar URL in `User.image` instead of persisting expiring presigned URLs.
- Prefer resolving stable API avatar paths through `NEXT_PUBLIC_API_URL` in local dev instead of storing web-relative URLs
  that would point to the Next.js dev server.
- Keep Railway Bucket private and have the API upload/delete/generate presigned read URLs.
- Keep preset avatars and initial-based default avatar behavior.

### Subagent Contributions

- Backend explorer identified current auth DTO/session behavior, missing storage layer, upload endpoint shape, cleanup risks,
  and Telegram overwrite risk.
- Frontend explorer identified `AccountSettings` and `AvatarPickerDialog` as the main integration points, validation
  changes, preview behavior, and generated API requirements.

### Blockers / Follow-ups

- Implementation requires Railway Bucket credentials in each target API environment.
- Final serving behavior should be validated once the exact Railway bucket URL style is known.

## 2026-06-17 15:37 +03 - Codex / Developer

### Scope

- Implemented the first full pass of backend storage, auth endpoints, frontend upload UI, validation, tests, and docs for
  custom user avatar uploads.
- Added private Railway Bucket storage through S3-compatible SDK calls while keeping `User.image` as the display field.
- Updated Telegram avatar sync to fill `User.image` only when the field is currently `null`.

### Files Changed

- `packages/api/prisma/schema.prisma`
- `packages/api/src/avatar/avatar.module.ts`
- `packages/api/src/avatar/avatar-storage.service.ts`
- `packages/api/src/auth/auth.controller.ts`
- `packages/api/src/auth/auth.dto.ts`
- `packages/api/src/auth/auth.module.ts`
- `packages/api/src/auth/auth.service.ts`
- `packages/api/src/auth/user-avatar-presets.ts`
- `packages/api/test/auth.e2e.test.ts`
- `packages/web/src/modules/auth/auth.api.ts`
- `packages/web/src/modules/auth/auth.api.test.ts`
- `packages/web/src/modules/auth/auth.validations.ts`
- `packages/web/src/modules/auth/auth.validations.test.ts`
- `packages/web/src/modules/auth/components/account-settings/AccountSettings.tsx`
- `packages/web/src/modules/auth/components/avatar-picker-dialog/AvatarPickerDialog.tsx`
- `packages/web/src/shared/components/UserAvatar.tsx`
- `packages/web/src/shared/lib/service-worker-cache-policy.test.ts`
- `packages/web/public/sw.js`
- `packages/api/.env.example`
- `docs/development.md`
- `docs/operations.md`
- `docs/domain-model.md`
- `docs/plans/user-avatar-upload/work-log.md`

### Commands Run

```bash
pnpm --filter api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm --filter api add -D @types/multer
date '+%Y-%m-%d %H:%M %Z'
```

### Results

- Dependencies installed successfully.
- Prisma postinstall generation ran against the then-current schema; explicit generation for the new schema is still pending.

### Decisions

- Store uploaded avatars as private bucket objects keyed by `User.avatarStorageKey`.
- Store stable uploaded avatar display paths as `/auth/users/:userId/avatar` in `User.image`.
- Resolve uploaded avatar paths to `NEXT_PUBLIC_API_URL` in `UserAvatar` and render non-preset avatar URLs with plain
  `img` to avoid Next image host configuration.
- Exclude `/auth/users/` from service worker caching as a future same-origin safeguard.
- Use `user.updateMany({ where: { id, image: null } })` for Telegram photo fill so existing preset/uploaded avatars are
  not overwritten and non-null images do not throw.

### Subagent Contributions

- Backend explorer: confirmed auth DTO/controller/service changes, multipart setup requirements, test mock seams, and
  the existing profile patch image-clearing bug.
- Frontend explorer: confirmed AccountSettings/AvatarPickerDialog integration points, wrapper/test locations, and the
  stable API path rendering/cache pitfalls.

### Blockers / Follow-ups

- Run Prisma/OpenAPI/Orval generation and targeted verification.
- Run `pnpm db:push` only against the intended MongoDB environment to apply the new `avatarStorageKey` field.

## 2026-06-17 15:40 +03 - Codex / Developer

### Scope

- Completed generation, formatting, targeted tests, full tests, and final verification for user avatar uploads.
- Fixed issues found during verification: omitted `image` DTO semantics under Nest transform, React Query mutation
  inference, generated redirect response schema, import ordering, and intentional `img` lint suppressions.

### Files Changed

- Same implementation files as the previous entry, plus generated artifacts:
  - `packages/api/openapi.json`
  - `packages/web/src/shared/api/generated/auth/auth.ts`
  - `packages/web/src/shared/api/generated/model/index.ts`
  - `packages/web/src/shared/api/generated/model/uploadUserAvatarDto.ts`
  - `pnpm-lock.yaml`

### Commands Run

```bash
pnpm db:generate
pnpm api:generate
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter web test src/modules/auth/auth.validations.test.ts src/modules/auth/auth.api.test.ts src/shared/lib/service-worker-cache-policy.test.ts
pnpm --filter api test test/auth.e2e.test.ts
pnpm api:check-generated
pnpm --filter api check
pnpm --filter web check
pnpm typecheck
pnpm test
pnpm check
git status --short
git diff --stat
```

### Results

- `pnpm db:generate`: passed.
- `pnpm api:generate`: passed.
- `pnpm --filter api typecheck`: passed.
- `pnpm --filter web typecheck`: initially failed on React Query mutation typing and nullable avatar values; fixed and
  passed.
- Targeted web tests: 3 files passed, 7 tests passed.
- `pnpm --filter api test test/auth.e2e.test.ts`: initially failed on omitted `image`; fixed and passed with 48 tests.
- `pnpm api:check-generated`: passed.
- `pnpm --filter api check`: initially failed on import ordering; fixed and passed.
- `pnpm --filter web check`: initially failed on deliberate `img` warnings, generated redirect schema warning, and import
  ordering; fixed and passed.
- `pnpm typecheck`: passed.
- `pnpm test`: passed with API 11 files / 142 tests and web 27 files / 107 tests.
- `pnpm check`: passed.

### Decisions

- Use `input.image !== undefined` for profile patch semantics because Nest transform can leave an optional DTO property
  present as `undefined`.
- Keep the uploaded-avatar read endpoint in OpenAPI with a `302` `Location` schema so generated clients stay lint-clean.
- Add narrow Biome suppressions for `img` where local object URLs or external/private avatar URLs are intentionally not
  rendered through Next Image.

### Subagent Contributions

- Backend explorer findings were incorporated into endpoint shape, DTO optionality, storage mocking, cleanup tests, and
  Telegram non-overwrite coverage.
- Frontend explorer findings were incorporated into the upload wrapper, validation tests, API path resolution, and service
  worker cache exclusion.

### Blockers / Follow-ups

- `pnpm db:push` was not run locally; run it against the intended MongoDB environment before deploying the new
  `avatarStorageKey` field.
- Real Railway Bucket upload/read behavior still needs environment credentials in DEV/PROD.
