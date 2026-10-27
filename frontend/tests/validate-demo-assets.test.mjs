import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { validateModelFile } from "../scripts/validate-demo-assets.mjs";

async function withModel(bytes, check) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, "spacial-model-test-"));
  try {
    const model = join(directory, "earth-final.glb");
    await writeFile(model, bytes);
    await check(model);
  } finally {
    // Only remove this test's explicitly created temporary directory.
    if (
      dirname(directory) !== parent ||
      !basename(directory).startsWith("spacial-model-test-")
    )
      throw new Error("Invalid test cleanup path");
    await rm(directory, { recursive: true, force: true });
  }
}

function minimalGlb() {
  const text = '{"asset":{"version":"2.0"}}';
  const json = Buffer.from(text + " ".repeat((4 - Buffer.byteLength(text) % 4) % 4));
  const result = Buffer.alloc(20 + json.length);
  result.write("glTF", 0, "ascii");
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  json.copy(result, 20);
  return result;
}

test("real GLB binary passes validation", async () => {
  await withModel(minimalGlb(), async (model) =>
    assert.doesNotReject(validateModelFile(model)),
  );
});
test("Git LFS pointers are rejected with the download command", async () => {
  const pointer = `version https://git-lfs.github.com/spec/v1\noid sha256:${"0".repeat(64)}\nsize 100\n`;
  await withModel(pointer, async (model) =>
    assert.rejects(validateModelFile(model), /Git LFS pointer.*git lfs pull/),
  );
});
test("truncated model downloads are rejected", async () => {
  const model = minimalGlb();
  await withModel(model.subarray(0, 24), async (path) =>
    assert.rejects(validateModelFile(path), /Incomplete GLB file/),
  );
});
test("unexpected formats and unsupported GLB versions are rejected", async () => {
  await withModel("not a model", async (path) =>
    assert.rejects(validateModelFile(path), /Invalid GLB header/),
  );
  const model = minimalGlb();
  model.writeUInt32LE(1, 4);
  await withModel(model, async (path) =>
    assert.rejects(validateModelFile(path), /GLB version 2/),
  );
});
