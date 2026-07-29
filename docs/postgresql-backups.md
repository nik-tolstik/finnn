# Encrypted PostgreSQL Backups

## Purpose

`packages/postgres-backup` is a standalone Railway cron service for daily logical PostgreSQL backups. It streams a
PostgreSQL 18 custom-format dump directly into `age`, uploads only the encrypted file to private S3-compatible storage,
re-downloads the complete object to verify its SHA-256 digest, and uploads a completion manifest last.

The production Railway service currently uses the `finnn` prefix. The prefix is configurable, and the resulting object
layout is timestamped and append-only:

```text
finnn/production/daily/YYYY/MM/DD/finnn-YYYYMMDDTHHMMSSsssZ.dump.age
finnn/production/daily/YYYY/MM/DD/finnn-YYYYMMDDTHHMMSSsssZ.dump.age.manifest.json
```

Treat only a payload with a matching `status: "complete"` manifest as a completed backup. The manifest contains the
encrypted payload size and SHA-256, the SHA-256 of the decrypted PostgreSQL custom dump, the age recipient fingerprint,
and the creation time. It contains no database credentials or private encryption material.

## Security Model

- `pg_dump` writes its custom-format output to stdout, which is piped directly to `age`. Plaintext is not persisted by
  the backup job.
- Railway receives only the public `BACKUP_AGE_RECIPIENT`. Never store an age private identity in the backup service.
- The private age identity must be held separately in an encrypted password manager or offline recovery vault. Backup
  access without that identity is insufficient to read financial data.
- The S3-compatible bucket must remain private. Scope its credentials to the backup bucket and, where supported, the
  configured prefix. The job needs PutObject, HeadObject, GetObject, and DeleteObject for failed-verification cleanup.
- Database and object-storage credentials are passed only to the subprocess or SDK that needs them. Error reporting
  redacts known credential values, and successful logs contain only object identifiers, sizes, digests, and timestamps.
- The process uses a restrictive `077` umask, a mode-`0700` temporary directory, and mode-`0600` encrypted files. The
  temporary directory is removed on success, failure, signal, or timeout.

The encrypted payload SHA-256 proves that storage returned the bytes that were uploaded. The source SHA-256 proves that
a locally decrypted dump matches the original `pg_dump` stream. Neither checksum replaces age authentication or a
restore rehearsal.

## Create And Protect The Age Identity

Generate the identity on a trusted local machine with `age` installed, not in Railway:

```bash
umask 077
age-keygen -o finnn-postgres-backup.agekey
age-keygen -y finnn-postgres-backup.agekey > finnn-postgres-backup.recipient
```

Store `finnn-postgres-backup.agekey` in at least two independently protected recovery locations. The single line in
`finnn-postgres-backup.recipient` is public and becomes `BACKUP_AGE_RECIPIENT`. Losing the identity makes every backup
encrypted to it permanently unrecoverable. Anyone who obtains it can decrypt those backups.

For rotation, generate a new identity, update the Railway recipient, run and restore-test a backup with the new
recipient, and only then retire the old identity. Retain the old identity for at least as long as backups encrypted to it
exist. The derived recipient fingerprint in each manifest identifies which recovery identity is required.

## Railway Service Configuration

The checked-in [`packages/postgres-backup/railway.json`](../packages/postgres-backup/railway.json) builds
[`packages/postgres-backup/Dockerfile`](../packages/postgres-backup/Dockerfile), runs once daily at `02:00 UTC`, and uses
`restartPolicyType: NEVER`. The image is based on PostgreSQL 18 so `pg_dump` matches the production server major, and it
includes the `age` CLI and Node.js runtime.

Create the cron service manually in the correct Railway environment:

1. Keep the service root directory at `/` because its Docker build needs the workspace lockfile and package manifest.
2. Set the config-as-code path to `/packages/postgres-backup/railway.json`.
3. Do not create a public domain for the cron service.
4. Reference the direct production PostgreSQL URL as `BACKUP_DATABASE_URL`; do not route the dump through a transaction
   pooler.
5. Reference the private backup bucket credentials. The service supports configurable endpoint, region, bucket, and URL
   style. For the Railway virtual-host endpoint `https://t3.storageapi.dev`, keep
   `BACKUP_S3_FORCE_PATH_STYLE="false"`.
6. Add alerting for every non-zero cron result and for a missing daily completion manifest.

Railway cron schedules are UTC. A cron process must exit when its work finishes, and Railway skips an invocation when a
previous execution is still active. See the official [Railway cron documentation](https://docs.railway.com/cron-jobs)
and [config-as-code reference](https://docs.railway.com/config-as-code/reference).

### Required variables

```env
BACKUP_DATABASE_URL="postgresql-direct-connection-string"
BACKUP_ENVIRONMENT="production"
BACKUP_AGE_RECIPIENT="age1..."
BACKUP_S3_ENDPOINT="https://t3.storageapi.dev"
BACKUP_S3_REGION="auto"
BACKUP_S3_BUCKET="generated-api-bucket-name"
BACKUP_S3_ACCESS_KEY_ID="bucket-access-key-id"
BACKUP_S3_SECRET_ACCESS_KEY="bucket-secret-access-key"
```

### Optional variables

```env
BACKUP_S3_FORCE_PATH_STYLE="false"
BACKUP_S3_PREFIX="postgresql"
BACKUP_COMMAND_TIMEOUT_MS="1800000"
BACKUP_JOB_TIMEOUT_MS="2700000"
```

`BACKUP_COMMAND_TIMEOUT_MS` bounds the `pg_dump | age` pipeline. `BACKUP_JOB_TIMEOUT_MS` is a hard bound for the entire
job, including upload and full re-download verification. Signals and timeouts terminate the child processes, abort SDK
requests, remove temporary files, and produce a non-zero process exit.

## Completion And Monitoring

A successful invocation writes one JSON log record similar to:

```json
{
  "status": "complete",
  "createdAt": "2026-07-29T02:00:00.000Z",
  "bucket": "generated-api-bucket-name",
  "objectKey": "finnn/production/daily/2026/07/29/finnn-20260729T020000000Z.dump.age",
  "encryptedBytes": 123456,
  "encryptedSha256": "...",
  "sourceSha256": "...",
  "ageRecipientFingerprint": "...",
  "manifestKey": "finnn/production/daily/2026/07/29/finnn-20260729T020000000Z.dump.age.manifest.json",
  "manifestSha256": "..."
}
```

The job succeeds only after these steps complete:

1. `pg_dump --format=custom` exits successfully while its stdout is encrypted by `age`.
2. The encrypted payload is uploaded with SHA-256 metadata.
3. HeadObject confirms payload length and metadata.
4. GetObject re-downloads the entire payload and its SHA-256 matches the local encrypted file.
5. The completion manifest is uploaded last, then independently checked with HeadObject and GetObject.

On any failure, the process exits non-zero. It makes a bounded best-effort attempt to delete an unverified payload and
manifest. An encrypted payload without a completion manifest is incomplete and must not satisfy backup freshness
monitoring.

Monitor at least:

- Cron exit status and the final `status: complete` log.
- Presence and age of the newest production manifest.
- Unexpected changes in payload size compared with recent backups.
- Bucket access failures, hard timeouts, and skipped overlapping executions.
- The date and result of the last isolated restore rehearsal.

## Restore Runbook

Never restore directly over the production database. Use an empty, isolated PostgreSQL database and a trusted machine
with `age`, PostgreSQL 18 client tools, and enough encrypted local storage.

1. Download both the `.dump.age` payload and its `.manifest.json` from the private bucket using the provider UI or an
   S3-compatible client configured for the same endpoint. Confirm the manifest has `status: "complete"` and references
   the exact downloaded key.
2. Calculate the encrypted file checksum and compare it exactly with `object.sha256` in the manifest:

   ```bash
   sha256sum finnn-YYYYMMDDTHHMMSSsssZ.dump.age
   ```

3. Make the private identity available only as a local file and decrypt. The command refuses to expose identity material
   in command arguments or environment variables:

   ```bash
   umask 077
   BACKUP_AGE_IDENTITY_FILE="/secure/recovery/finnn-postgres-backup.agekey" \
     pnpm --filter postgres-backup decrypt -- \
     finnn-YYYYMMDDTHHMMSSsssZ.dump.age finnn-restore.dump
   ```

4. Calculate `sha256sum finnn-restore.dump` and compare it exactly with `source.sha256` in the manifest. A mismatch is a
   failed restore attempt.
5. Inspect and restore the custom dump into the isolated database:

   ```bash
   pg_restore --list finnn-restore.dump
   FINNN_PG_RESTORE_URL="postgresql://user:password@host:5432/finnn_restore?sslmode=require"
   pg_restore --dbname="$FINNN_PG_RESTORE_URL" --single-transaction --exit-on-error --no-owner --no-acl \
     finnn-restore.dump
   ```

6. Point Prisma administrative checks at the isolated database, verify migration status, row counts, account-balance and
   debt invariants, and representative authenticated reads. Record the tested object key, result, and operator.
7. Remove the plaintext dump using the approved secure-deletion procedure for the workstation or destroy the encrypted
   temporary volume. Ordinary file deletion or `shred` is not a reliable guarantee on every SSD or copy-on-write
   filesystem.

Run an isolated restore after initial setup, after encryption identity rotation, before a risky schema or cutover event,
and at least quarterly. A successful upload without a successful restore rehearsal is not a validated recovery path.

## Retention And Incident Handling

Railway Bucket does not currently expose a lifecycle policy for this service. Do not delete any completed backup during
the first 90 days. After restore rehearsals establish the long-term retention tiers, implement a separately reviewed
client-side or manual pruning procedure; do not add deletion to the backup cron itself. Pruning must inventory complete
manifest/payload pairs, preserve the agreed minimum generations, and delete a pair only after a newer backup has passed
an isolated restore. Preserve provider point-in-time recovery separately when available. Never expire an age identity
before every payload encrypted to it has expired.

If a job fails:

1. Keep the API running unless database integrity itself is in doubt; a logical backup failure does not automatically
   require application downtime.
2. Inspect the non-secret failure log and Railway cron status.
3. Confirm direct PostgreSQL connectivity, S3 endpoint/region/bucket/addressing style, credential permissions, free
   bucket capacity, and timeout settings.
4. Re-run the cron only after resolving the cause. Confirm a new completion manifest and schedule an isolated restore if
   the failure involved encryption or upload verification.
5. If the private age identity is suspected compromised, restrict bucket access, rotate the recipient, create and test a
   new backup, and follow the organization incident-response process. Existing payloads remain decryptable with the
   compromised identity and may need re-encryption or shortened retention.
