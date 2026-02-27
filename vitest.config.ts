import { getViteConfig } from "astro/config";

// Reuses Astro's Vite config (plugins, path aliases, etc.) so nothing is duplicated.
export default getViteConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/api/**"],
      exclude: ["src/**/*.test.ts"],
    },
  },
});
