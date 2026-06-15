import "../src/common/env/load-env";
import { PrismaClient } from "@prisma/client";

import { ensureDatabaseUrl } from "../src/common/env/database-url";

const TELEGRAM_PROVIDER = "telegram";

type CliArgs = {
  email: string;
  providerUserId: string;
  move: boolean;
};

function getArgValue(name: string, argv = process.argv): string | undefined {
  const prefix = `--${name}=`;
  return argv
    .slice(2)
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
    .trim();
}

function parseArgs(argv = process.argv): CliArgs {
  const email = getArgValue("email", argv);
  const providerUserId = getArgValue("providerUserId", argv);

  if (!email || !providerUserId) {
    throw new Error(
      "Usage: pnpm --filter api telegram:link-mini -- --email=user@example.com --providerUserId=455466975 [--move]"
    );
  }

  return {
    email,
    providerUserId,
    move: argv.includes("--move"),
  };
}

function createPrismaClient(databaseUrl = ensureDatabaseUrl()): PrismaClient {
  return new PrismaClient(
    databaseUrl
      ? {
          datasourceUrl: databaseUrl,
        }
      : undefined
  );
}

async function linkTelegramMiniIdentity(args = parseArgs(), prisma = createPrismaClient()): Promise<void> {
  try {
    const user = await prisma.user.findFirst({
      where: { email: args.email },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new Error(`User with email ${args.email} was not found.`);
    }

    const existingIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: TELEGRAM_PROVIDER,
          providerUserId: args.providerUserId,
        },
      },
      select: { id: true, userId: true, username: true, displayName: true, photoUrl: true },
    });

    if (existingIdentity?.userId === user.id) {
      process.stdout.write(`Telegram Mini App identity ${args.providerUserId} is already linked to ${args.email}.\n`);
      return;
    }

    if (existingIdentity && !args.move) {
      throw new Error(
        `Telegram Mini App identity ${args.providerUserId} is linked to user ${existingIdentity.userId}. Re-run with --move to relink it to ${user.id}.`
      );
    }

    if (existingIdentity) {
      await prisma.authIdentity.update({
        where: { id: existingIdentity.id },
        data: { userId: user.id },
      });
      process.stdout.write(`Moved Telegram Mini App identity ${args.providerUserId} to ${args.email} (${user.id}).\n`);
      return;
    }

    await prisma.authIdentity.create({
      data: {
        provider: TELEGRAM_PROVIDER,
        providerUserId: args.providerUserId,
        user: { connect: { id: user.id } },
      },
    });
    process.stdout.write(`Linked Telegram Mini App identity ${args.providerUserId} to ${args.email} (${user.id}).\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  linkTelegramMiniIdentity().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
