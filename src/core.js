(function exposeCore(root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  root.AICCCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCore() {
  "use strict";
  const SCHEMA_VERSION = 1;
  const MAX_PANELS = 4;
  const PROVIDERS = new Set(['chatgpt','claude','grok','gemini','deepseek','perplexity','copilot','aistudio']);
  function validateState(candidate) {
    const identifier=value=>typeof value==='string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
    function walk(value) {
      if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return;
      if(Array.isArray(value)){value.forEach(walk);return;}
      if(!value||typeof value!=='object')throw new Error('Invalid organization data.');
      for(const [key,entry] of Object.entries(value)){
        if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe data property.');
        if(key!=='provenanceId' && (key==='id'||key.endsWith('Id')) && entry!=='' && !identifier(entry))throw new Error('Invalid identifier.');
        walk(entry);
      }
    }
    walk(candidate);
    if(candidate.schemaVersion!==undefined&&candidate.schemaVersion!==SCHEMA_VERSION)throw new Error('Unsupported organization schema version.');
    if(candidate.settings!==undefined){if(!candidate.settings||typeof candidate.settings!=='object'||Array.isArray(candidate.settings))throw new Error('Invalid settings.');for(const key of ['onboardingComplete','utilityOpen'])if(candidate.settings[key]!==undefined&&typeof candidate.settings[key]!=='boolean')throw new Error('Invalid settings flag.');}
    if(candidate.providerSettings!==undefined){
      if(!candidate.providerSettings||typeof candidate.providerSettings!=='object'||Array.isArray(candidate.providerSettings))throw new Error('Invalid provider settings.');
      for(const [provider,settings]of Object.entries(candidate.providerSettings))if(!PROVIDERS.has(provider)||!settings||typeof settings!=='object'||Array.isArray(settings)||(settings.enabled!==undefined&&typeof settings.enabled!=='boolean')||(settings.displayName!==undefined&&typeof settings.displayName!=='string'))throw new Error('Invalid provider settings.');
    }
    if(!Array.isArray(candidate.workspaces)||!candidate.workspaces.length)throw new Error('At least one valid workspace is required.');
    const workspaceIds=new Set(),panelIds=new Set();
    for(const workspace of candidate.workspaces){
      if(!identifier(workspace.id)||workspaceIds.has(workspace.id)||typeof workspace.name!=='string'||!Array.isArray(workspace.panels)||workspace.panels.length>MAX_PANELS)throw new Error('Invalid or duplicate workspace.');
      workspaceIds.add(workspace.id);
      if(workspace.ratio!==undefined && (typeof workspace.ratio!=='number'||workspace.ratio<25||workspace.ratio>75))throw new Error('Invalid layout ratio.');
      for(const panel of workspace.panels){
        if(typeof panel.id!=='string'||!/^[a-z0-9-]{1,70}$/.test(panel.id)||panelIds.has(panel.id)||!PROVIDERS.has(panel.providerId)||typeof panel.accountLabel!=='string')throw new Error('Invalid or duplicate provider account.');
        panelIds.add(panel.id);
      }
    }
    for(const key of ['projects','labels','favorites','notes','snippets','library','handoffs','skills','packets','bookmarks','comparisons','presets']){
      if(candidate[key]!==undefined&&!Array.isArray(candidate[key]))throw new Error(`Invalid ${key} collection.`);
      const itemIds=new Set();
      for(const item of candidate[key]||[]){
        if(!item||typeof item!=='object'||!identifier(item.id))throw new Error(`Invalid ${key} item.`);
        if(itemIds.has(item.id))throw new Error(`Duplicate ${key} identifier.`);itemIds.add(item.id);
        for(const field of ['title','name','content','source','url','providerName','updatedAt','createdAt'])if(item[field]!==undefined&&typeof item[field]!=='string')throw new Error(`Invalid ${key} text field.`);
        if(item.labels!==undefined&&(!Array.isArray(item.labels)||item.labels.some(label=>typeof label!=='string')))throw new Error('Invalid labels.');
        if(key==='bookmarks'){const url=new URL(item.url);if(url.protocol!=='https:'||url.username||url.password)throw new Error('Invalid bookmark.');}
        if(key==='presets'&&(!Array.isArray(item.panels)||item.panels.length>MAX_PANELS||item.panels.some(panel=>!PROVIDERS.has(panel.providerId)||typeof panel.accountLabel!=='string')))throw new Error('Invalid preset.');
      }
    }
    if(candidate.mode!==undefined&&!['independent','compare','handoff'].includes(candidate.mode))throw new Error('Invalid interaction mode.');
    if(candidate.theme!==undefined&&!['dark','light','system'].includes(candidate.theme))throw new Error('Invalid theme.');
    return candidate;
  }
  function id(prefix = "id") { return `${prefix}-${globalThis.crypto.randomUUID()}`; }
  function defaultState() {
    const workspaceId = "workspace-default";
    return { schemaVersion: SCHEMA_VERSION, theme: "dark", mode: "independent", activeWorkspaceId: workspaceId, providerSettings: {}, workspaces: [{ id: workspaceId, name: "Main workspace", panels: [{ id: "panel-claude", providerId: "claude", accountLabel: "Claude — account 1" }, { id: "panel-chatgpt", providerId: "chatgpt", accountLabel: "ChatGPT — account 1" }] }], projects: [], labels: [], favorites: [], notes: [], snippets: [], library: [], handoffs: [], settings: { onboardingComplete: false, utilityOpen: true } };
  }
  function normalizeState(candidate) {
    const fallback = defaultState();
    if (!candidate || typeof candidate !== "object") return fallback;
    const workspaces = Array.isArray(candidate.workspaces) ? candidate.workspaces.filter((item) => item && typeof item.id === "string") : [];
    if (!workspaces.length) return fallback;
    validateState(candidate);
    const normalized = { ...fallback, ...candidate, schemaVersion: SCHEMA_VERSION, workspaces };
    normalized.activeWorkspaceId = workspaces.some((item) => item.id === normalized.activeWorkspaceId) ? normalized.activeWorkspaceId : workspaces[0].id;
    for (const key of ["projects", "labels", "favorites", "notes", "snippets", "library", "handoffs", "skills", "packets", "bookmarks", "comparisons", "presets"]) normalized[key] = Array.isArray(candidate[key]) ? candidate[key] : [];
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
  function importPayload(raw) { const payload = typeof raw === "string" ? JSON.parse(raw) : raw; if (!payload || payload.product !== "AI Command Center" || !payload.data) throw new Error("This is not an AI Command Center export."); validateState(payload.data);return normalizeState(payload.data); }
  function messageText(message) {
    const content = message?.content;
    if (Array.isArray(content?.parts)) return content.parts.filter((part) => typeof part === "string").join("\n");
    if (typeof content?.text === "string") return content.text;
    if (typeof message?.text === "string") return message.text;
    return "";
  }
  function importDocument(raw) {
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (payload?.product === "AI Command Center" && payload.data) return { kind: "workspace", state: importPayload(payload) };
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
  return Object.freeze({ SCHEMA_VERSION, MAX_PANELS, id, validateState, defaultState, normalizeState, activeWorkspace, addPanel, searchLibrary, exportPayload, importPayload, importDocument, escapeHtml });
});
