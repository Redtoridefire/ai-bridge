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
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
