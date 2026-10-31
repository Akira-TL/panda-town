import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "../logs/playwright-artifacts",
  reporter: [
    ["list"],
    ["json", { outputFile: "logs/playwright-results.json" }],
  ],
  use: {
    baseURL: process.env.PANDA_TEST_URL ?? "http://127.0.0.1:3017",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
