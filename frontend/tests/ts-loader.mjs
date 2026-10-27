// Test-only TypeScript loader; uses the project's compiler and alias configuration.
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve as resolvePath, dirname, extname } from "node:path";
const src = resolvePath(dirname(fileURLToPath(import.meta.url)), "../src");
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/"))
    return {
      url: pathToFileURL(resolvePath(src, specifier.slice(2) + ".ts")).href,
      shortCircuit: true,
    };
  if (
    specifier.startsWith(".") &&
    context.parentURL?.endsWith(".ts") &&
    !extname(specifier)
  )
    return {
      url: new URL(specifier + ".ts", context.parentURL).href,
      shortCircuit: true,
    };
  return next(specifier, context);
}
export async function load(url, context, next) {
  if (url.endsWith(".ts"))
    return {
      format: "module",
      source: ts.transpileModule(await readFile(new URL(url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      shortCircuit: true,
    };
  return next(url, context);
}
