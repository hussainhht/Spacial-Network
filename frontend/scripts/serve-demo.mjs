/** A static-only server: no Next runtime and no SPA fallback masking missing routes. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("out");
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/Spacial-Network";
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".ico": "image/x-icon",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === base) {
      res.writeHead(301, { Location: `${base}/${url.search}` });
      res.end();
      return;
    }
    if (!url.pathname.startsWith(`${base}/`)) throw new Error("Outside demo");
    let path = resolve(
      root,
      decodeURIComponent(url.pathname.slice(base.length + 1)),
    );
    if (path !== root && !path.startsWith(root + sep))
      throw new Error("Invalid path");
    if ((await stat(path)).isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        res.end();
        return;
      }
      path = resolve(path, "index.html");
    }
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Static demo page not found");
  }
}).listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
  console.log(
    `Static demo: http://localhost:${process.env.PORT ?? 3000}${base}/`,
  ),
);
