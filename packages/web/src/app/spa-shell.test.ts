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

  it("provides the Vite entry point, dependency optimization, and static-hosting history fallback", () => {
    const htmlEntry = readProjectFile("index.html");
    const mainSource = readProjectFile("src/main.tsx");
    const dashboardAuthGate = readProjectFile("src/routes/dashboard/components/DashboardAuthGate.tsx");
    const viteConfig = readProjectFile("vite.config.ts");
    const vercelConfig = JSON.parse(readProjectFile("vercel.json")) as {
      framework?: string;
      outputDirectory?: string;
      rewrites?: Array<{ source: string; destination: string }>;
    };

    expect(htmlEntry).toContain('<div id="root"></div>');
    expect(htmlEntry).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(htmlEntry).toContain('window.localStorage.getItem("theme")');
    expect(htmlEntry).toContain('window.matchMedia("(prefers-color-scheme: dark)")');
    expect(mainSource).toContain("<BrowserRouter>");
    expect(mainSource).toContain('window.addEventListener("vite:preloadError"');
    expect(mainSource).toContain("event.preventDefault()");
    expect(dashboardAuthGate).toContain("const { hash, pathname } = useLocation()");
    expect(viteConfig).toContain('"index.html"');
    expect(viteConfig).toContain('"src/**/*.{ts,tsx}"');
    expect(viteConfig).toContain('"!src/**/*.test.{ts,tsx}"');
    expect(viteConfig).toContain('"!src/**/*.stories.{ts,tsx}"');
    expect(vercelConfig.framework).toBe("vite");
    expect(vercelConfig.outputDirectory).toBe("dist");
    expect(vercelConfig.rewrites).toEqual([{ source: "/(.*)", destination: "/index.html" }]);
  });
});
