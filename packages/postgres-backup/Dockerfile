FROM node:22-bookworm-slim AS dependencies

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/postgres-backup/package.json packages/postgres-backup/package.json

RUN pnpm install --frozen-lockfile --filter postgres-backup --prod

FROM postgres:18-bookworm

RUN apt-get update \
  && apt-get install --yes --no-install-recommends age ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies --chown=postgres:postgres /workspace/node_modules /workspace/node_modules
COPY --from=dependencies --chown=postgres:postgres /workspace/packages/postgres-backup/node_modules /workspace/packages/postgres-backup/node_modules
COPY --chown=postgres:postgres packages/postgres-backup/package.json /workspace/packages/postgres-backup/package.json
COPY --chown=postgres:postgres packages/postgres-backup/src /workspace/packages/postgres-backup/src

ENV NODE_ENV=production
WORKDIR /workspace/packages/postgres-backup
USER postgres

CMD ["node", "src/index.mjs"]
