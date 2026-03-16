import { createPlaywrightConfig } from "./playwright.shared";

export default createPlaywrightConfig({
  baseURL: "http://127.0.0.1:3000",
  envFiles: [".env.test.local"],
  requiredEnv: ["SUPABASE_URL", "SUPABASE_KEY", "E2E_USERNAME", "E2E_PASSWORD"],
  webServerCommand: "npm run preview:e2e",
});
