"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const security = require("../src/security");

test("provider navigation only allows registered HTTPS origins", () => {
  assert.equal(security.isAllowedProviderUrl("https://chatgpt.com/c/123"), true);
  assert.equal(security.isAllowedProviderUrl("https://subdomain.claude.ai/path"), true);
  assert.equal(security.isAllowedProviderUrl("https://accounts.google.com/signin"), true);
  assert.equal(security.isAllowedProviderUrl("https://login.microsoftonline.com/common"), true);
  assert.equal(security.isAllowedProviderUrl("http://chatgpt.com"), false);
  assert.equal(security.isAllowedProviderUrl("https://chatgpt.com.evil.test"), false);
  assert.equal(security.isAllowedProviderUrl("javascript:alert(1)"), false);
});

test("external links and partitions are constrained", () => {
  assert.equal(security.isSafeExternalUrl("https://example.com"), true);
  assert.equal(security.isSafeExternalUrl("file:///etc/passwd"), false);
  assert.equal(security.PARTITION_PATTERN.test("persist:aicc-panel-account-1"), true);
  assert.equal(security.PARTITION_PATTERN.test("persist:other"), false);
});

test("export validation bounds content and sanitizes filenames", () => {
  const valid = security.validateExport({ format: "json", name: "my export", content: "{}" });
  assert.equal(valid.name, "my-export");
  assert.equal(security.validateExport({ format: "exe", content: "x" }), null);
  assert.equal(security.validateExport({ format: "json", content: "x".repeat(security.MAX_EXPORT_BYTES + 1) }), null);
});
