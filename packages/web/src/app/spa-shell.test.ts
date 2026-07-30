import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("SPA shell", () => {
  it("declares every public and protected route in React Router", () => {
    const appSource = readProjectFile("src/app/App.tsx");
    const routePaths = [
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "email-required",
      "invite/:token",
      "verify-email/:token",
      "dashboard",
      "analytics",
      "debts",
      "payments",
    ];

    expect(appSource).toContain("<Route index");
    for (const routePath of routePaths) {
      expect(appSource).toContain(`path="${routePath}"`);
    }
    expect(appSource).toContain('<Route path="*" element={<Navigate to="/" replace />} />');
  });

  it("provides the Vite entry point and a static-hosting history fallback", () => {
    const htmlEntry = readProjectFile("index.html");
    const mainSource = readProjectFile("src/main.tsx");
    const vercelConfig = JSON.parse(readProjectFile("vercel.json")) as {
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(htmlEntry).toContain('<div id="root"></div>');
    expect(htmlEntry).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(mainSource).toContain("<BrowserRouter>");
    expect(vercelConfig.rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }]);
  });
});
