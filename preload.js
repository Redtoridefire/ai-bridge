"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("commandCenter", Object.freeze({
  getAppMeta: () => ipcRenderer.invoke("app:get-meta"),
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
