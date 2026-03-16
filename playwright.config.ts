import fs from "node:fs";
import path from "node:path";

import localConfig from "./playwright.local.config";
import remoteConfig from "./playwright.remote.config";

function hasFile(filePath: string): boolean {
  return fs.existsSync(path.resolve(process.cwd(), filePath));
}

function resolvePlaywrightEnv(): "local" | "remote" {
  const requestedEnv = process.env.PLAYWRIGHT_ENV;

  if (requestedEnv === "local" || requestedEnv === "remote") {
    return requestedEnv;
  }

  const hasLocalConfig = hasFile(".env.test.local");
  const hasRemoteConfig = hasFile(".env.test");

  if (hasLocalConfig) {
    return "local";
  }

  if (hasRemoteConfig) {
    return "remote";
  }

  throw new Error(
    [
      "No Playwright env file found.",
      "Create `.env.test.local` for local runs or `.env.test` for remote runs.",
      "You can still force selection with PLAYWRIGHT_ENV=local or PLAYWRIGHT_ENV=remote once the matching file exists.",
    ].join(" ")
  );
}

const selectedEnv = resolvePlaywrightEnv();

export default selectedEnv === "local" ? localConfig : remoteConfig;
