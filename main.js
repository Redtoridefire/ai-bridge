"use strict";

const { app, BrowserWindow, dialog, ipcMain, session, shell, net } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { MAX_EXPORT_BYTES, PARTITION_PATTERN, isAllowedProviderUrl, isSafeExternalUrl, validateExport } = require("./src/security");
const { githubSkills, backupStore, boundedJson } = require('./src/local-services');

function configureProviderSession(partition) {
  if (!PARTITION_PATTERN.test(partition)) return;
  const providerSession = session.fromPartition(partition);
  const permitted = new Set(["media", "fullscreen", "clipboard-sanitized-write", "notifications"]);
  providerSession.setPermissionRequestHandler((webContents, permission, callback) => callback(isAllowedProviderUrl(webContents.getURL()) && permitted.has(permission)));
  providerSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => isAllowedProviderUrl(requestingOrigin || webContents?.getURL() || "") && permitted.has(permission));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1560, height: 980, minWidth: 1000, minHeight: 680,
    title: "AI Command Center", backgroundColor: "#0b1020", show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false,
      sandbox: true, webviewTag: true, webSecurity: true, allowRunningInsecureContent: false,
    },
  });
  win.removeMenu();
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (isSafeExternalUrl(url)) void shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (event, url) => { if (!url.startsWith("file://")) event.preventDefault(); });
  win.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    const partition = params.partition || "";
    if (!isAllowedProviderUrl(params.src) || !PARTITION_PATTERN.test(partition)) { event.preventDefault(); return; }
    delete webPreferences.preload;
    Object.assign(webPreferences, { nodeIntegration: false, nodeIntegrationInSubFrames: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false });
    configureProviderSession(partition);
  });
  win.webContents.on("did-attach-webview", (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => { if (isSafeExternalUrl(url)) void shell.openExternal(url); return { action: "deny" }; });
    contents.on("will-navigate", (event, url) => { if (!isAllowedProviderUrl(url)) { event.preventDefault(); if (isSafeExternalUrl(url)) void shell.openExternal(url); } });
  });
  void win.loadFile("index.html");
}

app.whenReady().then(() => {
  const backups = backupStore(path.join(app.getPath('userData'), 'organization-backups'));
  const trusted = event => event.senderFrame === event.sender.mainFrame && event.senderFrame.url === require('node:url').pathToFileURL(path.join(__dirname, 'index.html')).href;
  function handle(channel, action) {
    ipcMain.handle(channel, async (event, payload) => {
      if (!trusted(event)) return { ok: false, error: 'Untrusted caller.' };
      try { return { ok: true, ...await action(payload) }; } catch (error) { return { ok: false, error: error.message }; }
    });
  }
  handle('skills:github', async url => { if (typeof url !== 'string' || url.length > 2000) throw new Error('Invalid URL.'); return githubSkills(net.fetch, url); });
  handle('backup:save', async content => ({ name: await backups.save(content) }));
  handle('backup:list', async () => ({ names: await backups.list() }));
  handle('backup:read', async name => ({ content: await backups.read(name) }));
  handle('ollama:request', async payload => {
    if (payload?.action === 'models') return { data: await boundedJson(fetch, 'http://127.0.0.1:11434/api/tags') };
    if (payload?.action !== 'generate' || typeof payload.model !== 'string' || payload.model.length > 100 || typeof payload.prompt !== 'string' || payload.prompt.length > 120000) throw new Error('Invalid local AI request.');
    return { data: await boundedJson(fetch, 'http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: payload.model, prompt: payload.prompt, stream: false }) }) };
  });
  ipcMain.handle("app:get-meta", () => ({ version: app.getVersion(), platform: process.platform }));
  ipcMain.handle("shell:open-external", async (_event, url) => { if (!isSafeExternalUrl(url)) return { ok: false, error: "Only HTTPS links are allowed." }; await shell.openExternal(url); return { ok: true }; });
  ipcMain.handle("session:clear", async (_event, partition) => { if (!PARTITION_PATTERN.test(partition)) return { ok: false, error: "Invalid session." }; await session.fromPartition(partition).clearStorageData(); return { ok: true }; });
  ipcMain.handle("dialog:save-export", async (_event, rawPayload) => {
    const payload = validateExport(rawPayload);
    if (!payload) return { ok: false, error: "Invalid or oversized export." };
    const result = await dialog.showSaveDialog({ title: "Export AI Command Center data", defaultPath: `${payload.name}.${payload.format}`, filters: [{ name: payload.format.toUpperCase(), extensions: [payload.format] }] });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fs.writeFile(result.filePath, payload.content, { encoding: "utf8", flag: "w" });
    return { ok: true, path: result.filePath };
  });
  ipcMain.handle("dialog:open-import", async () => {
    const result = await dialog.showOpenDialog({ title: "Import AI Command Center JSON", properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const stats = await fs.stat(result.filePaths[0]);
    if (stats.size > MAX_EXPORT_BYTES) return { ok: false, error: "Import exceeds 20 MB." };
    return { ok: true, content: await fs.readFile(result.filePaths[0], "utf8") };
  });
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
