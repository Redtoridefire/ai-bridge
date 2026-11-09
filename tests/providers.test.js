"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { providers, byId } = require("../src/providers");

test("registry contains all required providers with unique HTTPS URLs", () => {
  const required = ["chatgpt", "claude", "grok", "gemini", "deepseek", "perplexity", "copilot", "aistudio"];
  assert.deepEqual(providers.map((provider) => provider.id), required);
  assert.equal(new Set(providers.map((provider) => provider.url)).size, required.length);
  for (const provider of providers) assert.equal(new URL(provider.url).protocol, "https:");
});

test("each provider states its integration capability and fallback", () => {
  for (const provider of providers) {
    assert.match(provider.capabilities.insert, /best-effort|manual/);
    assert.match(provider.capabilities.extract, /best-effort|manual/);
    assert.ok(Array.isArray(provider.selectors.composer));
    assert.equal(byId[provider.id], provider);
  }
});
