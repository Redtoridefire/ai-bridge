'use strict';
// Run with Electron, not node. Uses a temporary profile and a test crypto adapter;
// never touches the user's profile or claims to test Windows DPAPI itself.
const electron=require('electron');
const Module=require('node:module');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'aicc-migration-'));
electron.app.setPath('userData',profile);
const key=crypto.randomBytes(32),realLoad=Module._load;
const adapter={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'test-adapter',encryptString:text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(text,'utf8'),cipher.final(),cipher.getAuthTag()]);},decryptString:data=>{const cipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(-16));return Buffer.concat([cipher.update(data.subarray(12,-16)),cipher.final()]).toString('utf8');}};
let seed;
const ready=electron.app.whenReady().then(async()=>{
  seed=new electron.BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});
  // Use the exact legacy index URL, then verify migration from migration.html.
  await seed.loadFile(path.join(root,'index.html'));
  const sample=require('../src/core').defaultState();sample.notes=[{id:'note-migration',title:'Migration',content:'synthetic-private-text',workspaceId:sample.activeWorkspaceId}];
  await seed.webContents.executeJavaScript(`localStorage.setItem('aicc.state.v1',${JSON.stringify(JSON.stringify(sample))})`);
});
const mockedApp=new Proxy(electron.app,{get(target,key){if(key==='whenReady')return ()=>ready;const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
Module._load=function(name,...args){if(name==='electron')return {...electron,app:mockedApp,safeStorage:adapter};return realLoad.call(this,name,...args);};
require('../main');
Module._load=realLoad;
void ready.then(async()=>{
  for(let attempt=0;attempt<80;attempt++){
    const window=electron.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='aicc://app/index.html');
    if(window&&!window.webContents.isLoadingMainFrame()){
      const result=await window.webContents.executeJavaScript(`(async()=>{const loaded=await commandCenter.loadState();return {ok:loaded.ok,encrypted:loaded.encrypted,content:loaded.content,notice:document.querySelector('#privacy-status').textContent};})()`);
      assert.equal(result.ok,true);assert.equal(result.encrypted,true);assert.match(result.content,/synthetic-private-text/);
      assert.equal(await seed.webContents.executeJavaScript("localStorage.getItem('aicc.state.v1')"),null);
      const ciphertext=fs.readFileSync(path.join(profile,'organization.enc.json'),'utf8');assert.equal(ciphertext.includes('synthetic-private-text'),false);
      console.log('Electron legacy-origin migration verified; legacy plaintext removed only after encrypted round-trip. OS cryptography mocked.');
      electron.app.exit(0);return;
    }
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Migration UI did not become ready.');
}).catch(error=>{console.error(error);electron.app.exit(1);});
