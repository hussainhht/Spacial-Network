import { readdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

/** Next 16.3's Windows exporter can use path separators inside segment filenames.
 * The client requests dotted names. Add those names to the artifact itself so any
 * ordinary static host works; no server rewrite or router fallback is required.
 * On platforms that already emit dotted names this is a no-op.
 */
export async function normalizeExport(root = "out") {
  async function flatten(directory, prefix, outputDirectory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.isDirectory())
        await flatten(
          join(directory, item.name),
          `${prefix}.${item.name}`,
          outputDirectory,
        );
      else
        await copyFile(
          join(directory, item.name),
          join(outputDirectory, `${prefix}.${item.name}`),
        );
    }
  }
  async function visit(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      if (item.name.startsWith("__next."))
        await flatten(join(directory, item.name), item.name, directory);
      else await visit(join(directory, item.name));
    }
  }
  await visit(root);
}
