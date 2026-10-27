import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000/Spacial-Network/",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    reducedMotion: "reduce",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run serve:demo",
    url: "http://127.0.0.1:3000/Spacial-Network/",
    reuseExistingServer: !process.env.CI,
  },
});
