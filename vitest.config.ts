import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    // Tests hit a shared MySQL instance. Run files sequentially so importer
    // tests (which truncate tables) can't race CRM tests that read the
    // production-like fixture dataset.
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
