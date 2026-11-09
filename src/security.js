"use strict";

const PROVIDER_HOSTS = new Set([
  "chatgpt.com", "openai.com", "claude.ai", "anthropic.com", "grok.com", "x.com",
  "gemini.google.com", "google.com", "chat.deepseek.com", "deepseek.com",
  "www.perplexity.ai", "perplexity.ai", "copilot.microsoft.com", "microsoft.com",
  "microsoftonline.com", "live.com", "aistudio.google.com",
]);
const MAX_EXPORT_BYTES = 20 * 1024 * 1024;
const PARTITION_PATTERN = /^persist:aicc-[a-z0-9-]{1,80}$/;

function isAllowedProviderUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && [...PROVIDER_HOSTS].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

function isSafeExternalUrl(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function validateExport(payload) {
  if (!payload || typeof payload !== "object" || !new Set(["json", "md", "html"]).has(payload.format) || typeof payload.content !== "string") return null;
  if (Buffer.byteLength(payload.content, "utf8") > MAX_EXPORT_BYTES) return null;
  const name = String(payload.name || "ai-command-center-export").replace(/[^a-z0-9_.-]+/gi, "-").slice(0, 80);
  return { ...payload, name: name || "ai-command-center-export" };
}

module.exports = { PROVIDER_HOSTS, MAX_EXPORT_BYTES, PARTITION_PATTERN, isAllowedProviderUrl, isSafeExternalUrl, validateExport };
