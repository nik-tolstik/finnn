import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

type InjectedScript = {
  async?: boolean;
  onerror?: () => void;
  onload?: () => void;
  src?: string;
};

function getSdkLoaderSource(): string {
  const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
  const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1] ?? "");
  const sdkLoader = inlineScripts.find((source) => source.includes("__finnnTelegramMiniAppSdkReady"));

  if (!sdkLoader) {
    throw new Error("Telegram Mini App SDK loader was not found");
  }

  return sdkLoader;
}

function runSdkLoader(search: string, hash: string) {
  const injectedScripts: InjectedScript[] = [];
  const window = { location: { hash, search } } as {
    __finnnTelegramMiniAppSdkReady?: Promise<"failed" | "loaded">;
    location: { hash: string; search: string };
  };
  const document = {
    createElement: () => ({}) as InjectedScript,
    head: {
      appendChild: (script: InjectedScript) => injectedScripts.push(script),
    },
  };

  runInNewContext(getSdkLoaderSource(), { document, URLSearchParams, window });

  return { injectedScripts, window };
}

describe("Telegram Mini App SDK loader", () => {
  it("does not download the SDK for regular browser visits", () => {
    const { injectedScripts, window } = runSdkLoader("", "");

    expect(injectedScripts).toHaveLength(0);
    expect(window.__finnnTelegramMiniAppSdkReady).toBeUndefined();
  });

  it("loads the SDK asynchronously for Telegram launch parameters and exposes readiness", async () => {
    const { injectedScripts, window } = runSdkLoader("", "#tgWebAppVersion=9.0&tgWebAppData=signed-data");

    expect(injectedScripts).toHaveLength(1);
    expect(injectedScripts[0]).toMatchObject({
      async: true,
      src: "https://telegram.org/js/telegram-web-app.js",
    });

    injectedScripts[0]?.onload?.();
    await expect(window.__finnnTelegramMiniAppSdkReady).resolves.toBe("loaded");
  });

  it("reports an SDK load failure without leaving Mini App bootstrap pending", async () => {
    const { injectedScripts, window } = runSdkLoader("?tgWebAppVersion=9.0", "");

    injectedScripts[0]?.onerror?.();
    await expect(window.__finnnTelegramMiniAppSdkReady).resolves.toBe("failed");
  });
});
