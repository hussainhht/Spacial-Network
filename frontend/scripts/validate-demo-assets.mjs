import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MODEL_FILES = [
  "earth", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "sun", "moon",
].map((name) => `${name}-final.glb`);
const LFS_HELP = 'From the repository root, run: git lfs pull --include="frontend/public/models/planets/*.glb" --exclude=""';

/** Validate actual bytes, not just HTTP status or the .glb extension. */
export async function validateModelFile(filePath) {
  let file;
  try {
    file = await open(filePath, "r");
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Missing planet model: ${filePath}. ${LFS_HELP}`);
    throw error;
  }
  try {
    const header = Buffer.alloc(64);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    if (header.subarray(0, bytesRead).toString("utf8").startsWith("version https://git-lfs.github.com/spec/v1")) {
      throw new Error(`Planet model is a Git LFS pointer, not a 3D binary: ${filePath}. ${LFS_HELP}`);
    }
    if (bytesRead < 12 || header.toString("ascii", 0, 4) !== "glTF") {
      throw new Error(`Invalid GLB header in planet model: ${filePath}. ${LFS_HELP}`);
    }
    if (header.readUInt32LE(4) !== 2) {
      throw new Error(`Planet model must use GLB version 2: ${filePath}`);
    }
    const { size } = await file.stat();
    if (size !== header.readUInt32LE(8)) {
      throw new Error(`Incomplete GLB file: ${filePath}. Expected ${header.readUInt32LE(8)} bytes, received ${size}. ${LFS_HELP}`);
    }
  } finally {
    await file.close();
  }
}

export async function validateDemoAssets(publicDirectory = "public") {
  const directory = resolve(publicDirectory, "models", "planets");
  await Promise.all(MODEL_FILES.map((name) => validateModelFile(resolve(directory, name))));
  return MODEL_FILES.length;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const count = await validateDemoAssets(process.argv[2] ?? "public");
    console.log(`Verified ${count} real GLB planet models, including Earth's Moon.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
