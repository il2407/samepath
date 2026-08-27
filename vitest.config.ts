import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/shared/test/server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    // Integration tests share one real Postgres database and reset it with
    // a full TRUNCATE between tests — running test files in parallel would
    // let one file's reset wipe another file's in-flight fixtures. Trading
    // suite speed for correctness here; revisit if the suite gets slow
    // (e.g. per-file schemas or transaction-per-test rollback).
    fileParallelism: false,
  },
});
