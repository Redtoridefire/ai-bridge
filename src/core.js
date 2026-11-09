(function exposeCore(root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  root.AICCCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCore() {
  "use strict";
  const SCHEMA_VERSION = 1;
  const MAX_PANELS = 4;
  function id(prefix = "id") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  function defaultState() {
    const workspaceId = "workspace-default";
    return { schemaVersion: SCHEMA_VERSION, theme: "dark", mode: "independent", activeWorkspaceId: workspaceId, providerSettings: {}, workspaces: [{ id: workspaceId, name: "Main workspace", panels: [{ id: "panel-claude", providerId: "claude", accountLabel: "Claude — account 1" }, { id: "panel-chatgpt", providerId: "chatgpt", accountLabel: "ChatGPT — account 1" }] }], projects: [], labels: [], favorites: [], notes: [], snippets: [], library: [], handoffs: [], settings: { onboardingComplete: false, utilityOpen: true } };
  }
  function normalizeState(candidate) {
    const fallback = defaultState();
    if (!candidate || typeof candidate !== "object") return fallback;
    const workspaces = Array.isArray(candidate.workspaces) ? candidate.workspaces.filter((item) => item && typeof item.id === "string") : [];
    if (!workspaces.length) return fallback;
    const normalized = { ...fallback, ...candidate, schemaVersion: SCHEMA_VERSION, workspaces };
    normalized.activeWorkspaceId = workspaces.some((item) => item.id === normalized.activeWorkspaceId) ? normalized.activeWorkspaceId : workspaces[0].id;
    for (const key of ["projects", "labels", "favorites", "notes", "snippets", "library", "handoffs"]) normalized[key] = Array.isArray(candidate[key]) ? candidate[key] : [];
    normalized.settings = { ...fallback.settings, ...(candidate.settings || {}) };
    normalized.providerSettings = candidate.providerSettings && typeof candidate.providerSettings === "object" ? candidate.providerSettings : {};
    return normalized;
  }
  function activeWorkspace(state) { return state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) || state.workspaces[0]; }
  function addPanel(workspace, providerId, accountLabel) { if (workspace.panels.length >= MAX_PANELS) throw new Error(`A workspace supports up to ${MAX_PANELS} visible panels.`); return { ...workspace, panels: [...workspace.panels, { id: id("panel"), providerId, accountLabel }] }; }
  function searchLibrary(items, query, filters = {}) {
    const needle = String(query || "").trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (filters.providerId && item.providerId !== filters.providerId) return false;
      if (filters.projectId && item.projectId !== filters.projectId) return false;
      if (filters.label && !(item.labels || []).includes(filters.label)) return false;
      if (!needle) return true;
      const haystack = [item.title, item.content, item.providerName, ...(item.labels || [])].join(" ").toLocaleLowerCase();
      return needle.split(/\s+/).every((term) => haystack.includes(term));
    });
  }
  function exportPayload(state) { return { product: "AI Command Center", schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data: state }; }
  function importPayload(raw) { const payload = typeof raw === "string" ? JSON.parse(raw) : raw; if (!payload || payload.product !== "AI Command Center" || !payload.data) throw new Error("This is not an AI Command Center export."); return normalizeState(payload.data); }
  function messageText(message) {
    const content = message?.content;
    if (Array.isArray(content?.parts)) return content.parts.filter((part) => typeof part === "string").join("\n");
    if (typeof content?.text === "string") return content.text;
    if (typeof message?.text === "string") return message.text;
    return "";
  }
  function importDocument(raw) {
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (payload?.product === "AI Command Center" && payload.data) return { kind: "workspace", state: normalizeState(payload.data) };
    if (!Array.isArray(payload)) throw new Error("Unsupported JSON import. Choose an AI Command Center, ChatGPT, or Claude export.");
    const importedAt = new Date().toISOString();
    if (payload.some((conversation) => conversation?.mapping)) {
      const items = payload.map((conversation, index) => {
        const messages = Object.values(conversation.mapping || {}).map((node) => node?.message).filter(Boolean).sort((a, b) => (a.create_time || 0) - (b.create_time || 0));
        const content = messages.map((message) => { const text = messageText(message).trim(); return text ? `${String(message.author?.role || "message").toUpperCase()}:\n${text}` : ""; }).filter(Boolean).join("\n\n");
        return { id: `import-chatgpt-${conversation.id || index}`, provenanceId: `chatgpt:${conversation.id || index}`, title: conversation.title || `ChatGPT conversation ${index + 1}`, content, providerId: "chatgpt", providerName: "ChatGPT", projectId: "", labels: ["imported"], favorite: false, createdAt: conversation.create_time ? new Date(conversation.create_time * 1000).toISOString() : importedAt };
      }).filter((item) => item.content);
      return { kind: "library", providerId: "chatgpt", items };
    }
    if (payload.some((conversation) => Array.isArray(conversation?.chat_messages))) {
      const items = payload.map((conversation, index) => {
        const content = (conversation.chat_messages || []).map((message) => { const text = messageText(message).trim(); return text ? `${String(message.sender || "message").toUpperCase()}:\n${text}` : ""; }).filter(Boolean).join("\n\n");
        return { id: `import-claude-${conversation.uuid || index}`, provenanceId: `claude:${conversation.uuid || index}`, title: conversation.name || `Claude conversation ${index + 1}`, content, providerId: "claude", providerName: "Claude", projectId: "", labels: ["imported"], favorite: false, createdAt: conversation.created_at || importedAt };
      }).filter((item) => item.content);
      return { kind: "library", providerId: "claude", items };
    }
    throw new Error("Unsupported provider export. Current import adapters support ChatGPT and Claude JSON exports.");
  }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
  return Object.freeze({ SCHEMA_VERSION, MAX_PANELS, id, defaultState, normalizeState, activeWorkspace, addPanel, searchLibrary, exportPayload, importPayload, importDocument, escapeHtml });
});
