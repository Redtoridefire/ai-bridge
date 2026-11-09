"use strict";

const { providers, byId } = window.AICCProviders;
const Core = window.AICCCore;
const STORAGE_KEY = "aicc.state.v1";
const SMOKE_MODE = new URLSearchParams(location.search).has("smoke");
const bridge = window.commandCenter || {
  getAppMeta: async () => ({ version: "browser-smoke", platform: "browser" }),
  saveExport: async () => ({ ok: false, error: "Native export is only available in the desktop app." }),
  openImport: async () => ({ ok: false, error: "Native import is only available in the desktop app." }),
};
const viewCache = new Map();
let state = loadState();
let utilityTab = "notes";
let itemKind = "note";
let toastTimer;
let renamingWorkspace = false;
const comparisonTargets = new Map();

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return Core.normalizeState(JSON.parse(saved));
    const legacy = JSON.parse(localStorage.getItem("aibridge.panes") || "null");
    if (Array.isArray(legacy) && legacy.length) {
      const migrated = Core.defaultState();
      migrated.workspaces[0].panels = legacy.map((pane) => ({ id: `panel-${String(pane.id).replace(/[^a-z0-9-]/gi, "").toLowerCase()}`, providerId: String(pane.platform || "").toLowerCase(), accountLabel: pane.label || pane.platform }));
      return Core.normalizeState(migrated);
    }
  } catch (error) { console.warn("Could not load local state", error); }
  return Core.normalizeState(Core.defaultState());
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateState(mutator, { panels = false } = {}) {
  mutator(state);
  state = Core.normalizeState(state);
  persist();
  renderChrome();
  if (panels) renderPanels();
}

function currentWorkspace() { return Core.activeWorkspace(state); }
function providerName(id) { return state.providerSettings[id]?.displayName || byId[id]?.name || id; }
function isProviderEnabled(id) { return state.providerSettings[id]?.enabled !== false; }
function partitionFor(panel) { return `persist:aicc-${panel.id.replace(/[^a-z0-9-]/g, "").slice(0, 70)}`; }

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
}

function setStatus(message) { $("#global-status").textContent = message; }

function applyTheme() { document.documentElement.dataset.theme = state.theme; }

function renderChrome() {
  applyTheme();
  const workspace = currentWorkspace();
  $("#workspace-select").innerHTML = state.workspaces.map((item) => `<option value="${Core.escapeHtml(item.id)}" ${item.id === workspace.id ? "selected" : ""}>${Core.escapeHtml(item.name)}</option>`).join("");
  $$("[data-mode]").forEach((button) => { button.classList.toggle("active", button.dataset.mode === state.mode); button.setAttribute("aria-selected", String(button.dataset.mode === state.mode)); });
  $("#compare-bar").hidden = state.mode !== "compare";
  $("#handoff-bar").hidden = state.mode !== "handoff";
  $("#provider-list").innerHTML = providers.filter((provider) => isProviderEnabled(provider.id)).map((provider) => {
    const count = workspace.panels.filter((panel) => panel.providerId === provider.id).length;
    return `<button class="provider-item" data-add-provider="${provider.id}"><span class="provider-dot" style="background:${provider.color}"></span><span>${Core.escapeHtml(providerName(provider.id))}</span><small>${count || "+"}</small></button>`;
  }).join("");
  renderCompareTargets();
  renderUtility();
  document.querySelector(".app-shell").classList.toggle("utility-closed", !state.settings.utilityOpen);
}

function createWebview(panel) {
  if (viewCache.has(panel.id)) return viewCache.get(panel.id);
  const provider = byId[panel.providerId];
  if (SMOKE_MODE) {
    const placeholder = document.createElement("div");
    placeholder.className = "empty-workspace";
    placeholder.innerHTML = `<div><strong>${Core.escapeHtml(providerName(provider.id))}</strong><p class="muted">Renderer smoke-test placeholder</p></div>`;
    viewCache.set(panel.id, placeholder);
    return placeholder;
  }
  const view = document.createElement("webview");
  view.src = provider.url;
  view.setAttribute("partition", partitionFor(panel));
  view.setAttribute("allowpopups", "");
  view.setAttribute("aria-label", `${providerName(provider.id)} web content`);
  view.addEventListener("did-start-loading", () => updatePanelStatus(panel.id, "Loading…"));
  view.addEventListener("did-stop-loading", () => updatePanelStatus(panel.id, "Connected"));
  view.addEventListener("did-fail-load", (event) => { if (event.errorCode !== -3) updatePanelStatus(panel.id, "Load failed"); });
  view.addEventListener("page-title-updated", (event) => { view.dataset.pageTitle = event.title; });
  viewCache.set(panel.id, view);
  return view;
}

function updatePanelStatus(panelId, text) {
  const target = document.querySelector(`[data-panel-status="${panelId}"]`);
  if (target) target.textContent = text;
}

function renderPanels() {
  const grid = $("#panel-grid");
  const workspace = currentWorkspace();
  grid.dataset.count = String(workspace.panels.length || 1);
  const known = new Set(state.workspaces.flatMap(item => item.panels.map(panel => panel.id)));
  grid.querySelectorAll('.provider-panel').forEach(wrapper => {
    if (!known.has(wrapper.dataset.panelId)) { viewCache.delete(wrapper.dataset.panelId); wrapper.remove(); }
    else wrapper.hidden = wrapper.dataset.workspaceId !== workspace.id;
  });
  grid.querySelector('.empty-workspace')?.closest('section.empty-workspace')?.remove();
  if (!workspace.panels.length) {
    const empty = document.createElement("section");
    empty.className = "empty-workspace";
    empty.innerHTML = `<div><h2>Build your workspace</h2><p class="muted">Add an AI provider account. Sign-in happens on the provider's real website in an isolated session.</p><button class="primary" data-empty-add>Add provider account</button></div>`;
    grid.append(empty);
  }
  workspace.panels.forEach((panel, index) => {
    const provider = byId[panel.providerId];
    if (!provider) return;
    let wrapper = [...grid.querySelectorAll('.provider-panel')].find(item => item.dataset.panelId === panel.id);
    if (wrapper && wrapper.dataset.providerId !== panel.providerId) { wrapper.remove(); viewCache.delete(panel.id); wrapper = null; }
    if (wrapper) { wrapper.hidden = false; wrapper.style.order = index; return; }
    wrapper = document.createElement("section");
    wrapper.className = "provider-panel";
    wrapper.dataset.panelId = panel.id;
    wrapper.dataset.workspaceId = workspace.id;
    wrapper.dataset.providerId = panel.providerId;
    wrapper.style.order = index;
    wrapper.innerHTML = `<header class="panel-header"><span class="provider-dot" style="background:${provider.color}"></span><strong title="${Core.escapeHtml(panel.accountLabel)}">${Core.escapeHtml(panel.accountLabel)}</strong><span class="panel-status" data-panel-status="${panel.id}">Ready</span><button data-panel-back="${panel.id}" title="Back">←</button><button data-panel-reload="${panel.id}" title="Reload">↻</button><button data-panel-remove="${panel.id}" title="Remove panel">×</button></header><div class="webview-slot"></div>`;
    wrapper.querySelector(".webview-slot").append(createWebview(panel));
    grid.append(wrapper);
  });
  if (typeof applyPanelLayout === 'function') applyPanelLayout();
}

function renderCompareTargets() {
  const panels = currentWorkspace().panels;
  const workspaceId = currentWorkspace().id;
  if (!comparisonTargets.has(workspaceId)) comparisonTargets.set(workspaceId, new Set(panels.slice(0, 2).map((panel) => panel.id)));
  const selected = comparisonTargets.get(workspaceId);
  $("#compare-targets").innerHTML = panels.map((panel) => `<label class="target-chip"><input type="checkbox" value="${panel.id}" ${selected.has(panel.id) ? "checked" : ""}><span>${Core.escapeHtml(panel.accountLabel)}</span></label>`).join("") || `<span class="muted">Add at least two panels.</span>`;
}

function showUtility(tab) {
  utilityTab = tab;
  if (!state.settings.utilityOpen) updateState((draft) => { draft.settings.utilityOpen = true; });
  else renderUtility();
}

function renderUtility() {
  $$("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === utilityTab));
  $$(".utility-view").forEach((view) => { view.hidden = view.id !== `utility-${utilityTab}`; });
  renderNotes(); renderSnippets(); renderLibrary();
}

function cardMarkup(item, kind) {
  const favorite = item.favorite ? "★" : "☆";
  return `<article class="local-card"><header><strong>${Core.escapeHtml(item.title)}</strong>${kind === "library" ? `<button data-favorite-item="${Core.escapeHtml(item.id)}" title="Favorite">${favorite}</button>` : ""}<button data-delete-item="${kind}:${Core.escapeHtml(item.id)}" title="Delete">×</button></header><p>${Core.escapeHtml(item.content)}</p>${kind==='snippet'?`<button data-snippet-use="${Core.escapeHtml(item.id)}">Use template</button>`:''}<small>${Core.escapeHtml(item.providerName || item.updatedAt?.slice(0, 10) || "Local")}${item.labels?.length ? ` · ${Core.escapeHtml(item.labels.join(", "))}` : ""}</small></article>`;
}

function renderNotes() {
  const items = state.notes.filter((note) => note.workspaceId === currentWorkspace().id);
  $("#notes-list").innerHTML = items.length ? items.map((item) => cardMarkup(item, "note")).join("") : `<div class="empty-state">No notes in this workspace yet.</div>`;
}

function renderSnippets() {
  const query = $('#snippet-search').value.toLowerCase();
  const items = state.snippets.filter(item => `${item.title} ${item.content}`.toLowerCase().includes(query));
  $("#snippets-list").innerHTML = items.length ? items.map((item) => cardMarkup(item, "snippet")).join("") : `<div class="empty-state">Save prompts you want to reuse.</div>`;
}

function renderLibrary() {
  const providerFilter = $("#library-provider-filter");
  const currentProvider = providerFilter.value;
  providerFilter.innerHTML = `<option value="">All providers</option>${providers.map((provider) => `<option value="${provider.id}">${Core.escapeHtml(providerName(provider.id))}</option>`).join("")}`;
  providerFilter.value = currentProvider;
  const projectFilter = $("#library-project-filter");
  const currentProject = projectFilter.value;
  projectFilter.innerHTML = `<option value="">All projects</option>${state.projects.map((project) => `<option value="${project.id}">${Core.escapeHtml(project.name)}</option>`).join("")}`;
  projectFilter.value = currentProject;
  const results = Core.searchLibrary(state.library, $("#library-search").value, { providerId: providerFilter.value, projectId: projectFilter.value });
  $("#library-results").innerHTML = results.length ? results.map((item) => cardMarkup(item, "library")).join("") : `<div class="empty-state">No locally saved content matches. Provider history is not indexed unless you explicitly save or import it.</div>`;
}

function openPanelDialog(providerId = "chatgpt") {
  if (!providers.some((provider) => isProviderEnabled(provider.id))) return toast("Enable a provider in Settings first");
  $("#panel-provider").innerHTML = providers.filter((provider) => isProviderEnabled(provider.id)).map((provider) => `<option value="${provider.id}">${Core.escapeHtml(providerName(provider.id))}</option>`).join("");
  $("#panel-provider").value = isProviderEnabled(providerId) ? providerId : $("#panel-provider").options[0]?.value;
  $("#panel-label").value = `${providerName($("#panel-provider").value)} — account ${currentWorkspace().panels.filter((panel) => panel.providerId === $("#panel-provider").value).length + 1}`;
  $("#panel-dialog").showModal();
}

function addPanelFromDialog(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const providerId = $("#panel-provider").value;
  const label = $("#panel-label").value.trim();
  try {
    updateState((draft) => {
      const index = draft.workspaces.findIndex((workspace) => workspace.id === draft.activeWorkspaceId);
      draft.workspaces[index] = Core.addPanel(draft.workspaces[index], providerId, label);
    }, { panels: true });
    $("#panel-dialog").close(); toast("Provider account added");
  } catch (error) { toast(error.message); }
}

function removePanel(panelId) {
  const panel = currentWorkspace().panels.find((item) => item.id === panelId);
  if (!panel || !confirm(`Remove “${panel.accountLabel}” from this workspace? Its session can also be cleared from provider settings.`)) return;
  updateState((draft) => { const workspace = Core.activeWorkspace(draft); workspace.panels = workspace.panels.filter((item) => item.id !== panelId); }, { panels: true });
  const view = viewCache.get(panelId); if (view) view.remove(); viewCache.delete(panelId);
}

function buildExtractScript(provider, scope) {
  if (scope === "selection") return `String(window.getSelection ? window.getSelection().toString() : "").slice(0,120000)`;
  const user = JSON.stringify(provider.selectors.user);
  const assistant = JSON.stringify(provider.selectors.assistant);
  return `(function(){const us=${user},as=${assistant};const selectors=us.concat(as);if(!selectors.length)return "";const nodes=[...document.querySelectorAll(selectors.join(","))];const seen=[];const rows=[];for(const node of nodes){if(seen.some(parent=>parent.contains(node)))continue;seen.push(node);const text=(node.innerText||"").trim();if(!text)continue;const role=us.some(selector=>{try{return node.matches(selector)}catch{return false}})?"USER":"ASSISTANT";rows.push(role+":\\n"+text)}const result=rows.join("\\n\\n");return result.length>120000?"[Earlier content trimmed]\\n"+result.slice(-120000):result})()`;
}

function buildInsertScript(provider, content) {
  return `(function(){const selectors=${JSON.stringify(provider.selectors.composer)};let target=null;for(const selector of selectors){const matches=document.querySelectorAll(selector);if(matches.length){target=matches[matches.length-1];break}}if(!target)return "NO_INPUT";target.focus();const value=${JSON.stringify(content)};if(target.tagName==="TEXTAREA"||target.tagName==="INPUT"){const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target),"value")?.set;setter?setter.call(target,value):(target.value=value);target.dispatchEvent(new Event("input",{bubbles:true}))}else{document.execCommand("selectAll",false,null);document.execCommand("insertText",false,value);target.dispatchEvent(new InputEvent("input",{bubbles:true,inputType:"insertText",data:value}))}return "PREPARED"})()`;
}

async function prepareComparison() {
  const prompt = $("#compare-prompt").value.trim();
  const targets = $$("#compare-targets input:checked").map((input) => input.value);
  if (!prompt || targets.length < 2) return toast("Enter a prompt and select at least two panels");
  await navigator.clipboard.writeText(prompt);
  let prepared = 0;
  for (const panelId of targets) {
    const panel = currentWorkspace().panels.find((item) => item.id === panelId);
    const provider = byId[panel?.providerId];
    const view = viewCache.get(panelId);
    if (!provider || !view || provider.capabilities.insert === "manual") { updatePanelStatus(panelId, "Copied · paste manually"); continue; }
    try {
      const result = await view.executeJavaScript(buildInsertScript(provider, prompt), true);
      if (result === "PREPARED") { prepared += 1; updatePanelStatus(panelId, "Prompt ready · review"); }
      else updatePanelStatus(panelId, "Copied · paste manually");
    } catch { updatePanelStatus(panelId, "Copied · paste manually"); }
  }
  setStatus(`Comparison prepared in ${prepared}/${targets.length} panels · prompt also copied`);
  toast("Review each provider, then submit in its own panel");
}

function openHandoffDialog() {
  const panels = currentWorkspace().panels;
  const options = panels.map((panel) => `<option value="${panel.id}">${Core.escapeHtml(panel.accountLabel)}</option>`).join("");
  $("#handoff-source").innerHTML = options; $("#handoff-destination").innerHTML = options;
  if (panels[1]) $("#handoff-destination").value = panels[1].id;
  $("#handoff-content").value = ""; updateHandoffCapability(); $("#handoff-dialog").showModal();
}

function updateHandoffCapability() {
  const panel = currentWorkspace().panels.find((item) => item.id === $("#handoff-source").value);
  const capability = byId[panel?.providerId]?.capabilities.extract || "manual";
  $("#handoff-capability").textContent = capability === "best-effort" ? "Best-effort extraction; review carefully." : "Manual copy/paste is required for this provider.";
}

async function extractHandoff() {
  const panel = currentWorkspace().panels.find((item) => item.id === $("#handoff-source").value);
  const provider = byId[panel?.providerId];
  const view = viewCache.get(panel?.id);
  if (!provider || !view || (provider.capabilities.extract === "manual" && $("#handoff-scope").value !== "selection")) {
    await navigator.clipboard.writeText("Paste the selected provider conversation into the handoff preview, then review and redact it.");
    return toast("Automatic extraction is unavailable; instructions copied");
  }
  try {
    let content = await view.executeJavaScript(buildExtractScript(provider, $("#handoff-scope").value), true);
    if ($("#handoff-scope").value === "summary" && content) content = `Please summarize this conversation for a handoff while preserving decisions, constraints, and open tasks:\n\n${content}`;
    if (!content?.trim()) return toast("No supported content found; paste it manually");
    $("#handoff-content").value = content; toast("Content loaded — review and redact it");
  } catch { toast("Extraction failed; use manual copy/paste"); }
}

async function confirmHandoff(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const content = $("#handoff-content").value.trim();
  const source = currentWorkspace().panels.find((item) => item.id === $("#handoff-source").value);
  const destination = currentWorkspace().panels.find((item) => item.id === $("#handoff-destination").value);
  if (!content || !source || !destination || source.id === destination.id) return toast("Choose different source and destination panels, with content to share");
  await navigator.clipboard.writeText(content);
  let inserted = false;
  const provider = byId[destination.providerId];
  if ($("#handoff-try-insert").checked && provider.capabilities.insert !== "manual") {
    try { inserted = await viewCache.get(destination.id)?.executeJavaScript(buildInsertScript(provider, content), true) === "PREPARED"; } catch { inserted = false; }
  }
  updateState((draft) => {
    draft.handoffs.unshift({ id: Core.id("handoff"), sourceProviderId: source.providerId, destinationProviderId: destination.providerId, scope: $("#handoff-scope").value, characterCount: content.length, createdAt: new Date().toISOString() });
    if ($("#handoff-save-local").checked) draft.library.unshift({ id: Core.id("library"), title: `Handoff: ${source.accountLabel} → ${destination.accountLabel}`, content, providerId: source.providerId, providerName: providerName(source.providerId), projectId: "", labels: ["handoff"], favorite: false, createdAt: new Date().toISOString() });
  });
  $("#handoff-dialog").close();
  setStatus(`Handoff ready for ${destination.accountLabel} · final submission remains yours`);
  toast(inserted ? "Destination populated — review and submit there" : "Content copied — paste and submit in destination");
}

function openItemDialog(kind) {
  itemKind = kind;
  const titles = { note: ["Add note", "Saved in this workspace."], snippet: ["Add prompt snippet", "Reusable across workspaces."], library: ["Add to local library", "Only content you explicitly add is searchable."] };
  $("#item-title").textContent = titles[kind][0]; $("#item-description").textContent = titles[kind][1];
  $("#item-name").value = ""; $("#item-content").value = ""; $("#item-labels").value = ""; $("#item-favorite").checked = false;
  $("#library-fields").hidden = kind !== "library";
  $("#item-provider").innerHTML = `<option value="">Unspecified</option>${providers.map((provider) => `<option value="${provider.id}">${Core.escapeHtml(providerName(provider.id))}</option>`).join("")}`;
  $("#item-project").innerHTML = `<option value="">No project</option>${state.projects.map((project) => `<option value="${project.id}">${Core.escapeHtml(project.name)}</option>`).join("")}`;
  $("#item-dialog").showModal();
}

function saveItem(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const title = $("#item-name").value.trim(); const content = $("#item-content").value.trim();
  if (!title || !content) return;
  updateState((draft) => {
    const base = { id: Core.id(itemKind), title, content, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    if (itemKind === "note") draft.notes.unshift({ ...base, workspaceId: draft.activeWorkspaceId });
    if (itemKind === "snippet") draft.snippets.unshift(base);
    if (itemKind === "library") {
      const providerId = $("#item-provider").value;
      draft.library.unshift({ ...base, providerId, providerName: providerId ? providerName(providerId) : "Local", projectId: $("#item-project").value, labels: $("#item-labels").value.split(",").map((label) => label.trim()).filter(Boolean), favorite: $("#item-favorite").checked });
    }
  });
  $("#item-dialog").close(); toast("Saved locally");
}

function deleteItem(kind, id) {
  if (!confirm("Delete this local item?")) return;
  updateState((draft) => { const key = kind === "note" ? "notes" : kind === "snippet" ? "snippets" : "library"; draft[key] = draft[key].filter((item) => item.id !== id); });
}

function openSettings() {
  $("#theme-select").value = state.theme;
  $("#provider-settings").innerHTML = providers.map((provider) => `<div class="provider-setting"><input type="checkbox" data-provider-enabled="${provider.id}" ${isProviderEnabled(provider.id) ? "checked" : ""} aria-label="Enable ${provider.name}"><input type="text" data-provider-name="${provider.id}" value="${Core.escapeHtml(providerName(provider.id))}" maxlength="40"><small>${provider.capabilities.compare}</small></div>`).join("");
  $("#projects-input").value = state.projects.map((project) => project.name).join(", ");
  $("#labels-input").value = state.labels.map((label) => label.name).join(", ");
  $("#settings-dialog").showModal();
}

function saveSettings(event) {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  updateState((draft) => {
    draft.theme = $("#theme-select").value;
    providers.forEach((provider) => { draft.providerSettings[provider.id] = { enabled: $(`[data-provider-enabled="${provider.id}"]`).checked, displayName: $(`[data-provider-name="${provider.id}"]`).value.trim() || provider.name }; });
    draft.projects = $("#projects-input").value.split(",").map((name) => name.trim()).filter(Boolean).map((name, index) => ({ id: draft.projects.find((project) => project.name === name)?.id || `project-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name }));
    draft.labels = $("#labels-input").value.split(",").map((name) => name.trim()).filter(Boolean).map((name, index) => ({ id: `label-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name }));
  });
  $("#settings-dialog").close(); toast("Settings saved");
}

async function exportData(format = "json") {
  const payload = Core.exportPayload(state);
  let content;
  if (format === "json") content = JSON.stringify(payload, null, 2);
  if (format === "md") content = `# AI Command Center export\n\nExported ${payload.exportedAt}\n\n${state.library.map((item) => `## ${item.title}\n\n${item.content}`).join("\n\n")}`;
  if (format === "html") content = `<!doctype html><meta charset="utf-8"><title>AI Command Center export</title><h1>AI Command Center export</h1>${state.library.map((item) => `<article><h2>${Core.escapeHtml(item.title)}</h2><pre>${Core.escapeHtml(item.content)}</pre></article>`).join("")}`;
  const result = await bridge.saveExport({ format, name: `ai-command-center-${new Date().toISOString().slice(0, 10)}`, content });
  if (result.ok) toast("Export saved"); else if (!result.canceled) toast(result.error || "Export failed");
}

async function importData() {
  const result = await bridge.openImport();
  if (!result.ok) { if (!result.canceled) toast(result.error || "Import failed"); return; }
  try {
    const imported = Core.importDocument(result.content);
    if (imported.kind === "workspace") {
      if (!confirm("Replace current organization data and workspace layouts with this import? Provider login sessions are not included.")) return;
      state = imported.state; persist(); renderChrome(); renderPanels(); $("#settings-dialog").close(); toast("Workspace import complete"); return;
    }
    const known = new Set(state.library.map((item) => item.provenanceId).filter(Boolean));
    const additions = imported.items.filter((item) => !known.has(item.provenanceId));
    updateState((draft) => { draft.library.unshift(...additions); });
    $("#settings-dialog").close(); showUtility("library");
    toast(`Imported ${additions.length} conversations; skipped ${imported.items.length - additions.length} duplicates`);
  } catch (error) { toast(error.message); }
}

function createWorkspace() {
  openWorkspaceDialog(false);
}

function openWorkspaceDialog(rename) {
  renamingWorkspace = rename;
  $("#workspace-dialog-title").textContent = rename ? "Rename workspace" : "New workspace";
  $("#workspace-name").value = rename ? currentWorkspace().name : `Workspace ${state.workspaces.length + 1}`;
  $("#workspace-dialog").showModal();
}

function bindEvents() {
  $("#workspace-select").addEventListener("change", (event) => updateState((draft) => { draft.activeWorkspaceId = event.target.value; }, { panels: true }));
  $("#workspace-add").addEventListener("click", createWorkspace);
  $("#workspace-rename").addEventListener("click", () => openWorkspaceDialog(true));
  $("#workspace-form").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const name = $("#workspace-name").value.trim();
    if (!name) return;
    updateState((draft) => {
      if (renamingWorkspace) Core.activeWorkspace(draft).name = name;
      else { const workspace = { id: Core.id("workspace"), name, panels: [] }; draft.workspaces.push(workspace); draft.activeWorkspaceId = workspace.id; }
    }, { panels: !renamingWorkspace });
    $("#workspace-dialog").close();
  });
  $("#compare-targets").addEventListener("change", () => comparisonTargets.set(currentWorkspace().id, new Set($$("#compare-targets input:checked").map((input) => input.value))));
  $$("[data-mode]").forEach((button) => button.addEventListener("click", () => updateState((draft) => { draft.mode = button.dataset.mode; })));
  $("#add-panel").addEventListener("click", () => openPanelDialog());
  $("#panel-provider").addEventListener("change", (event) => { $("#panel-label").value = `${providerName(event.target.value)} — account ${currentWorkspace().panels.filter((panel) => panel.providerId === event.target.value).length + 1}`; });
  $("#panel-form").addEventListener("submit", addPanelFromDialog);
  $("#compare-prepare").addEventListener("click", prepareComparison);
  $("#handoff-open").addEventListener("click", openHandoffDialog);
  $("#handoff-source").addEventListener("change", updateHandoffCapability);
  $("#handoff-extract").addEventListener("click", extractHandoff);
  $("#handoff-form").addEventListener("submit", confirmHandoff);
  $$("[data-tab]").forEach((button) => button.addEventListener("click", () => showUtility(button.dataset.tab)));
  $$("[data-utility-tab]").forEach((button) => button.addEventListener("click", () => showUtility(button.dataset.utilityTab)));
  $("#utility-toggle").addEventListener("click", () => updateState((draft) => { draft.settings.utilityOpen = !draft.settings.utilityOpen; }));
  $("#note-add").addEventListener("click", () => openItemDialog("note"));
  $("#snippet-add").addEventListener("click", () => openItemDialog("snippet"));
  $('#snippet-search').addEventListener('input', renderSnippets);
  $("#library-add").addEventListener("click", () => openItemDialog("library"));
  $("#item-form").addEventListener("submit", saveItem);
  $("#library-search").addEventListener("input", renderLibrary);
  $("#library-provider-filter").addEventListener("change", renderLibrary);
  $("#library-project-filter").addEventListener("change", renderLibrary);
  $("#settings-open").addEventListener("click", openSettings);
  $("#settings-form").addEventListener("submit", saveSettings);
  $("#data-export").addEventListener("click", () => exportData("json"));
  $("#export-json").addEventListener("click", () => exportData("json"));
  $("#export-markdown").addEventListener("click", () => exportData("md"));
  $("#export-html").addEventListener("click", () => exportData("html"));
  $("#data-import").addEventListener("click", importData);
  $("#clear-workspace-data").addEventListener("click", () => { if (!confirm("Clear local notes, snippets, library items, projects, labels, favorites, and handoff metadata? Login sessions remain intact.")) return; updateState((draft) => { draft.projects = []; draft.labels = []; draft.favorites = []; draft.notes = []; draft.snippets = []; draft.library = []; draft.handoffs = []; }); toast("Local organization data cleared"); });
  $("#onboarding-finish").addEventListener("click", () => updateState((draft) => { draft.settings.onboardingComplete = true; }));
  document.addEventListener("click", (event) => {
    const providerButton = event.target.closest("[data-add-provider]"); if (providerButton) openPanelDialog(providerButton.dataset.addProvider);
    if (event.target.closest("[data-empty-add]")) openPanelDialog();
    const remove = event.target.closest("[data-panel-remove]"); if (remove) removePanel(remove.dataset.panelRemove);
    const reload = event.target.closest("[data-panel-reload]"); if (reload) viewCache.get(reload.dataset.panelReload)?.reload();
    const back = event.target.closest("[data-panel-back]"); if (back && viewCache.get(back.dataset.panelBack)?.canGoBack()) viewCache.get(back.dataset.panelBack).goBack();
    const deletion = event.target.closest("[data-delete-item]"); if (deletion) { const [kind, id] = deletion.dataset.deleteItem.split(":"); deleteItem(kind, id); }
    const favorite = event.target.closest("[data-favorite-item]"); if (favorite) updateState((draft) => { const item = draft.library.find((entry) => entry.id === favorite.dataset.favoriteItem); if (item) item.favorite = !item.favorite; });
  });
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key === "1") updateState((draft) => { draft.mode = "independent"; });
    if (event.ctrlKey && event.key === "2") updateState((draft) => { draft.mode = "compare"; });
    if (event.ctrlKey && event.key === "3") updateState((draft) => { draft.mode = "handoff"; });
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "p") openPanelDialog();
  });
}

async function initialize() {
  bindEvents(); renderChrome(); renderPanels();
  const meta = await bridge.getAppMeta(); $("#app-version").textContent = `v${meta.version} · ${meta.platform}`;
  if (!state.settings.onboardingComplete) $("#onboarding-dialog").showModal();
}

void initialize();
