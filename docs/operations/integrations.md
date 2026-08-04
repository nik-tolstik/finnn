# External Integrations

## Configuration Boundary

[`packages/api/.env.example`](../../packages/api/.env.example) and
[`packages/web/.env.example`](../../packages/web/.env.example) are the canonical variable inventories. Configure only
the integration features enabled for the target environment, and never copy provider secret values into documentation,
issue comments, logs, or command arguments.

Before changing an integration, resolve the live provider application, bot, sender domain, bucket, and callback or
webhook endpoint through authenticated metadata-only discovery. Keep credentials and public URLs isolated by
environment.

## OAuth And Telegram

Register each environment's API callback URL with its OAuth provider. Align the configured application URL, allowed
origins, cookie policy, callback URLs, and frontend API origin before testing sign-in.

Telegram Mini Apps and webhooks require public HTTPS. Use an environment-specific bot and configure its Web Login,
Mini App, and webhook settings for the matching application and API origins. Local development uses the workflow in
[`docs/development.md`](../development.md), including a public API tunnel where Telegram cannot reach localhost.

Telegram OIDC claims and Mini App `initData.user.id` can differ. The API normalizes OIDC claims to the numeric Telegram
identifier when present. To repair older identity records, obtain the normalized identifier from a server-side source,
then run:

```bash
pnpm --filter api telegram:link-mini -- --email=user@example.com --providerUserId=455466975
```

If that identifier created a temporary empty user, add `--move`. Delete the temporary user only after confirming it has
no workspace membership or financial data.

## Email

Email delivery uses the configured Resend API key and verified sender identity. If delivery fails, verify the sender
domain, key, sender address, generated public URLs, and the relevant notification record without exposing credentials.

Scheduled-payment reminder failures record the failed delivery channel. A Telegram failure can mean the recipient has
not linked Telegram or has no chat preference; an email failure commonly indicates sender-domain or provider-credential
configuration.

## Private Object Storage

Avatar and category-icon storage must remain private. Map the active bucket's S3-compatible metadata to the configured
application variables and use a dedicated non-production bucket where production objects must remain isolated.

The API stores object keys and exposes stable application paths that redirect reads to short-lived presigned URLs. If
the storage configuration is unavailable, upload and read endpoints must fail in a controlled way rather than writing
incomplete profile or category data.
