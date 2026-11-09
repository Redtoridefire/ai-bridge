(function exposeProviderRegistry(root, factory) {
  const registry = factory();
  if (typeof module === "object" && module.exports) module.exports = registry;
  root.AICCProviders = registry;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRegistry() {
  "use strict";
  const providers = [
    { id: "chatgpt", name: "ChatGPT", shortName: "GPT", url: "https://chatgpt.com", color: "#10a37f", capabilities: { extract: "best-effort", insert: "best-effort", compare: "assisted" }, selectors: { user: ["[data-message-author-role='user']"], assistant: ["[data-message-author-role='assistant']"], composer: ["#prompt-textarea", "div[contenteditable='true']"] } },
    { id: "claude", name: "Claude", shortName: "Claude", url: "https://claude.ai", color: "#d97757", capabilities: { extract: "best-effort", insert: "best-effort", compare: "assisted" }, selectors: { user: ["[data-testid='user-message']"], assistant: ["[data-testid='assistant-message']", ".font-claude-message", "[data-test-render-count] .standard-markdown"], composer: ["div[contenteditable='true'].ProseMirror", "div[contenteditable='true']"] } },
    { id: "grok", name: "Grok", shortName: "Grok", url: "https://grok.com", color: "#f4f4f5", capabilities: { extract: "manual", insert: "best-effort", compare: "assisted" }, selectors: { user: [], assistant: [], composer: ["textarea", "div[contenteditable='true']"] } },
    { id: "gemini", name: "Gemini", shortName: "Gemini", url: "https://gemini.google.com", color: "#4f8df7", capabilities: { extract: "best-effort", insert: "best-effort", compare: "assisted" }, selectors: { user: ["user-query"], assistant: ["message-content"], composer: ["rich-textarea div[contenteditable='true']", "div[contenteditable='true']"] } },
    { id: "deepseek", name: "DeepSeek", shortName: "DeepSeek", url: "https://chat.deepseek.com", color: "#4d6bfe", capabilities: { extract: "manual", insert: "best-effort", compare: "assisted" }, selectors: { user: [], assistant: [], composer: ["textarea", "div[contenteditable='true']"] } },
    { id: "perplexity", name: "Perplexity", shortName: "PPLX", url: "https://www.perplexity.ai", color: "#20b8cd", capabilities: { extract: "manual", insert: "best-effort", compare: "assisted" }, selectors: { user: [], assistant: [], composer: ["textarea", "div[contenteditable='true']"] } },
    { id: "copilot", name: "Microsoft Copilot", shortName: "Copilot", url: "https://copilot.microsoft.com", color: "#7c3aed", capabilities: { extract: "best-effort", insert: "best-effort", compare: "assisted" }, selectors: { user: ["[data-content='user-message']"], assistant: ["[data-content='ai-message']"], composer: ["textarea", "div[contenteditable='true']"] } },
    { id: "aistudio", name: "Google AI Studio", shortName: "AI Studio", url: "https://aistudio.google.com", color: "#f6c445", capabilities: { extract: "manual", insert: "manual", compare: "manual" }, selectors: { user: [], assistant: [], composer: [] } },
  ];
  const byId = Object.fromEntries(providers.map((provider) => [provider.id, provider]));
  return Object.freeze({ providers: Object.freeze(providers), byId: Object.freeze(byId) });
});
