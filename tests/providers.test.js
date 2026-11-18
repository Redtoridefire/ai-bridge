"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { providers, byId } = require("../src/providers");

test("registry contains all required providers with unique HTTPS URLs", () => {
  const required = ["chatgpt", "claude", "grok", "gemini", "deepseek", "perplexity", "copilot", "aistudio", "muse"];
  assert.deepEqual(providers.map((provider) => provider.id), required);
  assert.equal(new Set(providers.map((provider) => provider.url)).size, required.length);
  for (const provider of providers) assert.equal(new URL(provider.url).protocol, "https:");
});

test('Muse uses the requested site and manual integration capabilities',()=>{
  const Core=require('../src/core');
  const security=require('../src/security');
  const muse=byId.muse;
  assert.equal(muse.url,'https://muse.ai/');
  assert.deepEqual(muse.capabilities,{extract:'manual',insert:'manual',compare:'manual'});
  assert.deepEqual(muse.selectors,{user:[],assistant:[],composer:[]});
  const state=Core.defaultState();
  state.workspaces[0]=Core.addPanel(state.workspaces[0],'muse','Muse — work');
  state.providerSettings.muse={enabled:true,displayName:'My Muse'};
  const restored=Core.importPayload(JSON.stringify(Core.exportPayload(state)));
  assert.equal(restored.workspaces[0].panels.at(-1).providerId,'muse');
  assert.equal(restored.providerSettings.muse.displayName,'My Muse');
  assert.equal(security.providerForUrl(muse.url),'muse');
  assert.equal(security.isProviderUrl('https://muse.ai/account','muse'),true);
  for(const url of ['https://muse.ai.evil.test','https://unverified.muse.ai','https://muse.ai:4443','http://muse.ai','https://chatgpt.com'])assert.equal(security.isProviderUrl(url,'muse',true),false);
  assert.equal(security.isProviderUrl(muse.url,'claude',true),false);
});

test("each provider states its integration capability and fallback", () => {
  for (const provider of providers) {
    assert.match(provider.capabilities.insert, /best-effort|manual/);
    assert.match(provider.capabilities.extract, /best-effort|manual/);
    assert.ok(Array.isArray(provider.selectors.composer));
    assert.equal(byId[provider.id], provider);
  }
});
