"use strict";

const PROVIDER_ORIGINS = Object.freeze({
  chatgpt: ['https://chatgpt.com'], claude: ['https://claude.ai'], grok: ['https://grok.com'],
  gemini: ['https://gemini.google.com'], deepseek: ['https://chat.deepseek.com'],
  perplexity: ['https://www.perplexity.ai','https://perplexity.ai'],
  copilot: ['https://copilot.microsoft.com'], aistudio: ['https://aistudio.google.com'],
});
const AUTH_ORIGINS = Object.freeze({
  chatgpt: ['https://auth.openai.com','https://auth0.openai.com','https://accounts.google.com','https://login.microsoftonline.com','https://appleid.apple.com'],
  claude: ['https://accounts.google.com','https://console.anthropic.com'],
  grok: ['https://accounts.x.ai','https://x.com'],
  gemini: ['https://accounts.google.com'], deepseek: ['https://accounts.google.com'],
  perplexity: ['https://accounts.google.com','https://appleid.apple.com'],
  copilot: ['https://login.live.com','https://login.microsoftonline.com','https://account.live.com'],
  aistudio: ['https://accounts.google.com'],
});
function origin(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.origin : null; } catch { return null; }
}
function providerForUrl(value) { const target=origin(value);return Object.keys(PROVIDER_ORIGINS).find(id=>PROVIDER_ORIGINS[id].includes(target)); }
function isProviderUrl(value, providerId, authentication = false) {
  const target=origin(value);
  return !!target && !!PROVIDER_ORIGINS[providerId] && [...PROVIDER_ORIGINS[providerId],...(authentication?AUTH_ORIGINS[providerId]:[])].includes(target);
}
const MAX_EXPORT_BYTES = 20 * 1024 * 1024;
const PARTITION_PATTERN = /^persist:aicc-[a-z0-9-]{1,80}$/;

function isAllowedProviderUrl(value) {
  try {
    const url = new URL(value);
    return !!providerForUrl(url.href);
  } catch { return false; }
}

function isSafeExternalUrl(value) {
  try { const url=new URL(value);return url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port==='443'); } catch { return false; }
}

function validateExport(payload) {
  if (!payload || typeof payload !== "object" || !new Set(["json", "md", "html"]).has(payload.format) || typeof payload.content !== "string") return null;
  if (Buffer.byteLength(payload.content, "utf8") > MAX_EXPORT_BYTES) return null;
  const name = String(payload.name || "ai-command-center-export").replace(/[^a-z0-9_.-]+/gi, "-").slice(0, 80);
  return { ...payload, name: name || "ai-command-center-export" };
}

module.exports = { PROVIDER_ORIGINS, AUTH_ORIGINS, origin, providerForUrl, isProviderUrl, MAX_EXPORT_BYTES, PARTITION_PATTERN, isAllowedProviderUrl, isSafeExternalUrl, validateExport };
