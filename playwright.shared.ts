import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "@playwright/test";

interface PlaywrightConfigOptions {
  baseURL?: string;
  envFiles: string[];
  requiredEnv?: string[];
  webServerCommand?: string;
}

function loadFirstExistingEnvFile(envFiles: string[]): void {
  for (const envFile of envFiles) {
    const resolvedPath = path.resolve(process.cwd(), envFile);

    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    dotenv.config({ path: resolvedPath, quiet: true });
    return;
  }
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createPlaywrightConfig(options: PlaywrightConfigOptions) {
  loadFirstExistingEnvFile(options.envFiles);

  if (options.requiredEnv) {
    for (const envName of options.requiredEnv) {
      requireEnv(envName);
    }
  }

  const baseURL = requireEnv("E2E_BASE_URL", options.baseURL);

  return defineConfig({
    testDir: "./e2e",
    use: {
      baseURL,
      testIdAttribute: "data-test-id",
      trace: "on-first-retry",
    },
    webServer: options.webServerCommand
      ? {
          command: options.webServerCommand,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
  });
}
