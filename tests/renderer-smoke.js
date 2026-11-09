"use strict";

const assert = require("node:assert/strict");

async function evaluate(webSocketUrl, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const timeout = setTimeout(() => { socket.close(); reject(new Error("DevTools evaluation timed out")); }, 8000);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } })));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timeout); socket.close();
      if (message.error || message.result?.exceptionDetails) reject(new Error(JSON.stringify(message.error || message.result.exceptionDetails)));
      else resolve(message.result.result.value);
    });
    socket.addEventListener("error", () => reject(new Error("DevTools WebSocket failed")));
  });
}

async function main() {
  const port = process.env.CDP_PORT || "9223";
  let targets;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json()); break; } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  const target = targets?.find((item) => item.type === "page" && item.url.includes("index.html"));
  assert.ok(target, "AI Command Center renderer target was not found");
  const result = await evaluate(target.webSocketDebuggerUrl, `new Promise(resolve=>setTimeout(()=>resolve({
    title:document.title,
    modes:[...document.querySelectorAll('[data-mode]')].map(el=>el.textContent.trim()),
    providers:document.querySelectorAll('#provider-list .provider-item').length,
    panels:document.querySelectorAll('.provider-panel').length,
    webviews:document.querySelectorAll('webview').length,
    utilityTabs:document.querySelectorAll('.utility-tabs button').length,
    appVersion:document.querySelector('#app-version')?.textContent,
    errors:window.__rendererErrors||[]
  }),300))`);
  console.log(JSON.stringify(result));
  assert.equal(result.title, "AI Command Center");
  assert.deepEqual(result.modes, ["Independent", "Compare", "Handoff"]);
  assert.equal(result.providers, 8);
  assert.equal(result.panels, 2);
  assert.equal(result.utilityTabs, 3);
  assert.ok(result.appVersion);
  const workflows = await evaluate(target.webSocketDebuggerUrl, `(async()=>{
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    const visible=id=>getComputedStyle(document.getElementById(id)).display!=='none';
    const states=[];
    const panel=document.querySelector('.provider-panel');
    for(const mode of ['independent','compare','handoff']){
      document.querySelector('[data-mode="'+mode+'"]').click();
      states.push({mode,compare:visible('compare-bar'),handoff:visible('handoff-bar')});
    }
    document.querySelector('[data-mode="compare"]').click();
    const checkbox=document.querySelector('#compare-targets input');
    checkbox.checked=false;checkbox.dispatchEvent(new Event('change',{bubbles:true}));
    if(document.querySelector('.app-shell').classList.contains('utility-closed')) document.querySelector('#utility-toggle').click();
    document.querySelector('#utility-toggle').click();
    const targetsPreserved=!document.querySelector('#compare-targets input').checked;
    document.querySelector('#workspace-rename').click();
    const name='Smoke renamed workspace';
    document.querySelector('#workspace-name').value=name;
    document.querySelector('#workspace-form button[value="default"]').click();
    const renamed=document.querySelector('#workspace-select option:checked').textContent===name;
    document.querySelector('#settings-open').click();
    document.querySelector('#settings-save').click();
    const panelPreserved=panel===document.querySelector('.provider-panel');
    document.querySelector('#handoff-open').click();
    document.querySelector('#handoff-content').value='Cancel regression';
    document.querySelector('#handoff-form button[value="cancel"]').click();
    const cancelClosed=!document.querySelector('#handoff-dialog').open;
    document.querySelector('[data-mode="independent"]').click();
    return {states,targetsPreserved,renamed,panelPreserved,cancelClosed,noOverflow:document.documentElement.scrollWidth<=innerWidth,width:innerWidth,scroll:document.documentElement.scrollWidth};
  })()`);
  assert.deepEqual(workflows.states, [
    {mode:'independent',compare:false,handoff:false},
    {mode:'compare',compare:true,handoff:false},
    {mode:'handoff',compare:false,handoff:true},
  ]);
  console.log('Workflow regressions passed', JSON.stringify(workflows));
  for (const key of ['targetsPreserved','renamed','panelPreserved','cancelClosed','noOverflow']) assert.equal(workflows[key], true, key);
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
module.exports = { evaluate };
