"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("commandCenter", Object.freeze({
  getAppMeta: () => ipcRenderer.invoke("app:get-meta"),
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (content) => ipcRenderer.invoke('state:save', content),
  providerAction: (payload) => ipcRenderer.invoke('provider:action', payload),
  eraseBackups: () => ipcRenderer.invoke('backup:erase'),
  revokePermissions: () => ipcRenderer.invoke('permissions:revoke'),
  openExternal: (url) => ipcRenderer.invoke("shell:open-external", url),
  clearSession: (partition) => ipcRenderer.invoke("session:clear", partition),
  saveExport: (payload) => ipcRenderer.invoke("dialog:save-export", payload),
  openImport: () => ipcRenderer.invoke("dialog:open-import"),
  githubSkills: (url) => ipcRenderer.invoke('skills:github', url),
  saveBackup: (content) => ipcRenderer.invoke('backup:save', content),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  readBackup: (name) => ipcRenderer.invoke('backup:read', name),
  ollama: (payload) => ipcRenderer.invoke('ollama:request', payload),
}));
