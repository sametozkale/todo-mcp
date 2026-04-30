import { test, expect } from "@playwright/test";

test.describe("public pages", () => {
  test("landing and login render without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Log in to Yalp AI/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Log in$/i })).toBeVisible();

    expect(errors, `page errors: ${errors.join("; ")}`).toEqual([]);
  });
});

test.describe("authenticated smoke (optional)", () => {
  test("dashboard when E2E credentials are set", async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run this test.");

    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email!);
    await page.locator('input[name="password"]').fill(password!);
    await page.getByRole("button", { name: /^Log in$/i }).click();
    await page.waitForURL(/\/(all|today)/, { timeout: 45_000 });
    await expect(page.locator("body")).toBeVisible();
  });
});
