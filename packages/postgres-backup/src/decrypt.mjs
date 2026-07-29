import { decryptAgeFile } from "./age.mjs";
import { sanitizedErrorMessage } from "./index.mjs";

export async function decryptMain(environment = process.env, arguments_ = process.argv.slice(2)) {
  const [inputPath, outputPath, ...extra] = arguments_;
  if (!inputPath || !outputPath || extra.length > 0) {
    console.error("Usage: pnpm --filter postgres-backup decrypt -- <encrypted-backup> <output-dump>");
    process.exitCode = 2;
    return;
  }

  try {
    const identityFile = environment.BACKUP_AGE_IDENTITY_FILE?.trim();
    if (!identityFile) {
      throw new Error("BACKUP_AGE_IDENTITY_FILE is required for local decryption");
    }
    process.umask(0o077);
    await decryptAgeFile({ inputPath, outputPath, identityFile, parentEnvironment: environment });
    console.log(`Decrypted backup written to ${outputPath}`);
  } catch (error) {
    console.error(`Backup decryption failed: ${sanitizedErrorMessage(error, environment)}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await decryptMain();
}
