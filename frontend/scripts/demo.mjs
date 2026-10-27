import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { normalizeExport } from "./normalize-export.mjs";
const require = createRequire(import.meta.url);
const command = process.argv[2] ?? "dev";
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    command,
    ...(command === "build" ? ["--webpack"] : []),
    ...process.argv.slice(3),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_DEMO_MODE: "true",
      NEXT_PUBLIC_BASE_PATH:
        process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network",
    },
  },
);
child.on("exit", async (code) => {
  if (code === 0 && command === "build") {
    try {
      await normalizeExport();
      writeFileSync("out/.nojekyll", "");
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }
  }
  process.exitCode = code ?? 1;
});
