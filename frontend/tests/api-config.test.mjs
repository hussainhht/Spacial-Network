import test from "node:test";
import assert from "node:assert/strict";
import { getApiUrl, getWebSocketUrl, getUploadsBaseUrl } from "../src/lib/api.ts";

test("production API and media stay same-origin and HTTPS selects WSS", () => {
 process.env.NODE_ENV = "production";
 delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
 delete process.env.NEXT_PUBLIC_BACKEND_WS_ORIGIN;
 globalThis.window = { location: { origin: "https://social.example.com" } };
 assert.equal(getApiUrl("/login"), "/api/login");
 assert.equal(getUploadsBaseUrl(), "/uploads");
 assert.equal(getWebSocketUrl(), "wss://social.example.com/api/ws");
 window.location.origin = "http://localhost:3000";
 assert.equal(getWebSocketUrl(), "ws://localhost:3000/api/ws");
 delete globalThis.window;
});
test("development and explicit build configuration remain supported", () => {
 process.env.NODE_ENV = "development";
 assert.equal(getApiUrl("/login"), "http://localhost:8080/api/login");
 process.env.NEXT_PUBLIC_BACKEND_ORIGIN = "https://api.example.com";
 assert.equal(getWebSocketUrl(), "wss://api.example.com/api/ws");
 delete process.env.NEXT_PUBLIC_BACKEND_ORIGIN;
});
