import { getViteConfig } from "astro/config";

// Reuses Astro's Vite config (plugins, path aliases, etc.) so nothing is duplicated.
export default getViteConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/pages/api/**", "src/components/**"],
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
