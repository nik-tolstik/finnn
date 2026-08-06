import { expect, test } from "@playwright/test";

test.describe("public authentication flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/auth/session", async (route) => {
      await route.fulfill({
        body: JSON.stringify({ authenticated: false, user: null }),
        contentType: "application/json",
        status: 200,
      });
    });
  });

  test("renders login, switches theme, captures a screenshot, and opens registration", async ({ page }, testInfo) => {
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    const requestFailures: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("requestfailed", (request) => {
      requestFailures.push(`${request.url()}: ${request.failure()?.errorText ?? "unknown"}`);
    });

    await page.goto("/login");
    await expect(page).toHaveTitle("Finnn - Учёт финансов");
    await expect(page.getByText("Вход", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Электронная почта")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Пароль" })).toBeVisible();

    await page.locator("label").filter({ hasText: "Тёмная" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: false });

    await page.getByRole("link", { name: "Зарегистрироваться" }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByText("Регистрация", { exact: true })).toBeVisible();

    expect(consoleMessages, consoleMessages.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    expect(requestFailures, requestFailures.join("\n")).toEqual([]);
  });
});
