import { expect, test } from "@playwright/test";

function requireEnv(name: "E2E_USERNAME" | "E2E_PASSWORD") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

const username = requireEnv("E2E_USERNAME");
const password = requireEnv("E2E_PASSWORD");

test("allows logging in from the homepage", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("navbar-login-link").click();

  await expect(page.getByTestId("login-page")).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login(?:[/?#].*)?$/);

  await page.getByTestId("login-email-input").fill(username);
  await page.getByTestId("login-password-input").fill(password);
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST"
  );
  await page.getByTestId("login-submit-button").click();

  const postLoginUrl = /\/(dashboard(?:\/profile)?|admin)(?:[/?#].*)?$/;
  const loginResponse = await loginResponsePromise;

  if (!loginResponse.ok()) {
    throw new Error(`Login request failed in E2E flow: ${loginResponse.status()} ${await loginResponse.text()}`);
  }

  await expect(page).toHaveURL(postLoginUrl, { timeout: 10000 });
  await expect(page.getByTestId("login-page")).toHaveCount(0);
});
