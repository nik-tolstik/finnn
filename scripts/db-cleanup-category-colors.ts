import { prisma } from "../src/shared/lib/prisma";

async function main() {
  const result = await prisma.$runCommandRaw({
    update: "categories",
    updates: [
      {
        q: { color: { $exists: true } },
        u: { $unset: { color: "" } },
        multi: true,
      },
    ],
  });

  process.stdout.write("Category color cleanup completed.\n");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write("Category color cleanup failed.\n");
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
