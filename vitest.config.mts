import { defineConfig } from "vitest/config";
import path from "node:path";
import { config } from "dotenv";

config({ quiet: true });

// Tests wipe tables, so they must only ever touch the dedicated test database.
if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
if (!/\/[^/]*test[^/]*$/i.test(process.env.TEST_DATABASE_URL.split("?")[0])) {
  throw new Error("TEST_DATABASE_URL must point at a database whose name contains 'test'");
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL, NODE_ENV: "test" },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: ["tests/global-setup.ts"],
  },
});
