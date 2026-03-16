import { createPlaywrightConfig } from "./playwright.shared";

export default createPlaywrightConfig({
  envFiles: [".env.test"],
  requiredEnv: ["E2E_BASE_URL", "E2E_USERNAME", "E2E_PASSWORD"],
});
