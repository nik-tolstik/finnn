import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const uiDir = path.resolve(process.cwd(), "src/shared/ui");
const componentFolderPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const componentFilePattern = /^[A-Z][A-Za-z0-9]*\.tsx$/;

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return walkFiles(fullPath);
    }

    return fullPath;
  });
}

describe("shared ui structure", () => {
  test("stores components in kebab-case folders with CamelCase files and barrel exports", () => {
    const rootEntries = readdirSync(uiDir, { withFileTypes: true });
    const rootComponentFiles = rootEntries.filter((entry) => entry.isFile() && entry.name.endsWith(".tsx"));
    const componentFolders = rootEntries.filter((entry) => entry.isDirectory());
    const allUiFiles = walkFiles(uiDir);
    const componentFiles = allUiFiles.filter((file) => file.endsWith(".tsx"));

    expect(rootEntries.map((entry) => entry.name)).toContain("index.ts");
    expect(rootComponentFiles.map((entry) => entry.name)).toEqual([]);
    expect(componentFolders.map((entry) => entry.name)).toEqual(
      componentFolders.map((entry) => entry.name).filter((folder) => componentFolderPattern.test(folder))
    );
    expect(componentFiles.map((file) => path.relative(uiDir, file))).toEqual(
      componentFiles
        .map((file) => path.relative(uiDir, file))
        .filter((file) => componentFilePattern.test(path.basename(file)))
    );

    for (const folder of componentFolders) {
      const folderPath = path.join(uiDir, folder.name);
      const folderFiles = readdirSync(folderPath);

      expect(folderFiles, `${folder.name} must export through index.ts`).toContain("index.ts");
    }
  });
});
