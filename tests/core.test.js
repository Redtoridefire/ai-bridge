"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/core");

test("default state has a usable two-panel workspace", () => {
  const state = Core.defaultState();
  assert.equal(Core.activeWorkspace(state).panels.length, 2);
  assert.equal(state.mode, "independent");
});

test("normalizeState repairs missing collections and active workspace", () => {
  const normalized = Core.normalizeState({ workspaces: [{ id: "w", name: "W", panels: [] }], activeWorkspaceId: "missing" });
  assert.equal(normalized.activeWorkspaceId, "w");
  assert.deepEqual(normalized.library, []);
});

test("panel limit protects usable layouts", () => {
  let workspace = { id: "w", name: "W", panels: [] };
  for (let index = 0; index < Core.MAX_PANELS; index += 1) workspace = Core.addPanel(workspace, "chatgpt", `Account ${index}`);
  assert.throws(() => Core.addPanel(workspace, "claude", "Too many"), /up to 4/);
});

test("local search combines text and exact filters without quotas", () => {
  const items = Array.from({ length: 12 }, (_, index) => ({ id: String(index), title: `Research ${index}`, content: index === 7 ? "quantum battery notes" : "general notes", providerId: index % 2 ? "claude" : "chatgpt", projectId: "p", labels: index === 7 ? ["favorite"] : [] }));
  assert.equal(Core.searchLibrary(items, "quantum battery", { providerId: "claude" }).length, 1);
  assert.equal(Core.searchLibrary(items, "", {}).length, 12);
});

test("JSON exports round-trip and reject unrelated documents", () => {
  const state = Core.defaultState();
  state.labels = Array.from({ length: 8 }, (_, index) => ({ id: `l${index}`, name: `Label ${index}` }));
  const restored = Core.importPayload(JSON.stringify(Core.exportPayload(state)));
  assert.equal(restored.labels.length, 8);
  assert.throws(() => Core.importPayload('{"data":{}}'), /not an AI Command Center export/);
});

test("official ChatGPT and Claude exports become provenance-aware library items", () => {
  const chatgpt = Core.importDocument([{ id: "g1", title: "GPT chat", mapping: { a: { message: { create_time: 1, author: { role: "user" }, content: { parts: ["Hello"] } } }, b: { message: { create_time: 2, author: { role: "assistant" }, content: { parts: ["Hi"] } } } } }]);
  assert.equal(chatgpt.items[0].provenanceId, "chatgpt:g1");
  assert.match(chatgpt.items[0].content, /USER:\nHello/);
  const claude = Core.importDocument([{ uuid: "c1", name: "Claude chat", chat_messages: [{ sender: "human", text: "Question" }, { sender: "assistant", text: "Answer" }] }]);
  assert.equal(claude.items[0].provenanceId, "claude:c1");
  assert.match(claude.items[0].content, /ASSISTANT:\nAnswer/);
});
