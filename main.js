'use strict';
const {app,BrowserWindow,dialog,ipcMain,session,shell,net,protocol,safeStorage}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const Security=require('./src/security');
const Core=require('./src/core');
const {byId}=require('./src/providers');
const {scriptFor}=require('./src/provider-actions');
const {privateStore}=require('./src/private-store');
const {githubSkills,backupStore,boundedJson}=require('./src/local-services');
const APP_URL='aicc://app/index.html';
protocol.registerSchemesAsPrivileged([{scheme:'aicc',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let appWindow,store,backups,initializing=true;
const policies=new Map(),guests=new Map(),bindings=new Map(),grants=new Set(),accountSessions=new Map();
const ASSETS=new Set(['index.html','styles.css','renderer.js','productivity-ui.js','src/providers.js','src/core.js','src/productivity.js']);

async function confirm(message,detail){
  const result=await dialog.showMessageBox(appWindow,{type:'question',buttons:['Cancel','Allow once'],defaultId:0,cancelId:0,message,detail,noLink:true});
  return result.response===1;
}
async function openExternal(url){
  if(!Security.isSafeExternalUrl(url))throw new Error('Only standard HTTPS links without embedded credentials are allowed.');
  if(await confirm('Open this link in your default browser?',url)){await shell.openExternal(url);return {ok:true};}
  return {ok:false,canceled:true};
}
function configureSession(partition,providerId){
  if(bindings.has(partition)&&bindings.get(partition)!==providerId)throw new Error('An account session cannot be reassigned to another provider.');
  bindings.set(partition,providerId);
  const actualPartition=store.available()?partition:partition.replace(/^persist:/,'');
  const ses=session.fromPartition(actualPartition);accountSessions.set(partition,ses);if(policies.has(ses))return actualPartition;policies.set(ses,providerId);
  ses.setPermissionCheckHandler((contents,permission,requestingOrigin,details)=>{
    if(!contents||contents.isDestroyed()||contents.session!==ses||!guests.has(contents.id)||permission!=='media'||details?.isMainFrame!==true||!Security.isProviderUrl(requestingOrigin,providerId))return false;
    return grants.has(`${partition}:${Security.origin(requestingOrigin)}:${details.mediaType}`);
  });
  ses.setPermissionRequestHandler(async(contents,permission,callback,details)=>{
    let allowed=false;
    try{
      const url=details?.requestingUrl,types=details?.mediaTypes;
      if(contents&&!contents.isDestroyed()&&contents.session===ses&&guests.has(contents.id)&&permission==='media'&&details?.isMainFrame===true&&Security.isProviderUrl(url,providerId)&&Security.origin(url)===Security.origin(contents.getURL())&&Array.isArray(types)&&types.length&&types.every(type=>['audio','video'].includes(type))){
        allowed=await confirm(`Allow ${byId[providerId].name} to use ${types.join(' and ')}?`,`${Security.origin(url)}\nGrant lasts only for this app session. You can revoke it in Settings.`);
        if(allowed&&!contents.isDestroyed()&&Security.origin(contents.getURL())===Security.origin(url))types.forEach(type=>grants.add(`${partition}:${Security.origin(url)}:${type}`));else allowed=false;
      }
    }catch{allowed=false;}
    callback(allowed);
  });
  ses.on('will-download',async(event,item)=>{
    event.preventDefault();
    if(Security.isSafeExternalUrl(item.getURL()))await openExternal(item.getURL()).catch(()=>{});
  });
  return actualPartition;
}
function createWindow(){
  appWindow=new BrowserWindow({width:1560,height:980,minWidth:1000,minHeight:680,title:'AI Command Center',backgroundColor:'#0b1020',show:false,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webviewTag:true,webSecurity:true,allowRunningInsecureContent:false}});
  appWindow.removeMenu();appWindow.once('ready-to-show',()=>appWindow.show());
  appWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  appWindow.webContents.on('will-navigate',event=>event.preventDefault());
  appWindow.webContents.on('will-redirect',event=>event.preventDefault());
  appWindow.webContents.on('will-attach-webview',(event,preferences,params)=>{
    const providerId=Security.providerForUrl(params.src),partition=params.partition;
    if(!providerId||typeof partition!=='string'||!Security.PARTITION_PATTERN.test(partition)||(bindings.has(partition)&&bindings.get(partition)!==providerId)){event.preventDefault();return;}
    delete preferences.preload;params.allowpopups=false;
    Object.assign(preferences,{nodeIntegration:false,nodeIntegrationInSubFrames:false,nodeIntegrationInWorker:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false});
    const actualPartition=configureSession(partition,providerId);preferences.partition=actualPartition;params.partition=actualPartition;
  });
  appWindow.webContents.on('did-attach-webview',(_event,contents)=>{
    const providerId=policies.get(contents.session);if(!providerId){contents.close();return;}
    guests.set(contents.id,{contents,providerId});contents.once('destroyed',()=>guests.delete(contents.id));
    contents.setWindowOpenHandler(()=>({action:'deny'}));
    const restrict=(event,url)=>{if(!Security.isProviderUrl(url,providerId,true))event.preventDefault();};
    contents.on('will-navigate',restrict);contents.on('will-redirect',restrict);
    contents.on('will-frame-navigate',(event,details)=>{if(details?.isMainFrame)restrict(event,details.url);});
    contents.on('did-navigate',(_event,url)=>{if(!Security.isProviderUrl(url,providerId,true)){contents.stop();void contents.loadURL(byId[providerId].url);}});
  });
  void appWindow.loadURL(APP_URL);
}
function trusted(event){return !!appWindow&&!appWindow.isDestroyed()&&event.sender===appWindow.webContents&&event.senderFrame===appWindow.webContents.mainFrame&&event.senderFrame?.url===APP_URL;}
function handle(channel,action){ipcMain.handle(channel,async(event,payload)=>{
  if(!trusted(event))return {ok:false,error:'Untrusted caller.'};
  try{return {ok:true,...await action(payload)};}catch(error){return {ok:false,error:error.message};}
});}
function validatePayload(content){if(typeof content!=='string'||Buffer.byteLength(content)>Security.MAX_EXPORT_BYTES)throw new Error('Invalid or oversized organization data.');const state=Core.importPayload(content);for(const workspace of state.workspaces)for(const panel of workspace.panels){const binding=bindings.get(`persist:aicc-${panel.id}`);if(binding&&binding!==panel.providerId)throw new Error('Imported state cannot reassign an existing account session to another provider.');}return content;}

async function migrateLegacy(){
  if(await store.exists()||!store.available())return;
  const window=new BrowserWindow({show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  try{
    await window.loadFile(path.join(__dirname,'migration.html'));
    const content=await window.webContents.executeJavaScript("localStorage.getItem('aicc.state.v1')");
    if(content){const payload=JSON.stringify(Core.exportPayload(Core.normalizeState(JSON.parse(content))));await store.save(validatePayload(payload));if(await store.read()!==payload)throw new Error('Migration verification failed.');await window.webContents.executeJavaScript("localStorage.removeItem('aicc.state.v1')");}
  }finally{window.destroy();}
}

app.whenReady().then(async()=>{
  store=privateStore(app.getPath('userData'),safeStorage);
  backups=backupStore(path.join(app.getPath('userData'),'organization-backups'),store);
  protocol.handle('aicc',async request=>{
    const url=new URL(request.url),asset=url.pathname.slice(1);
    if(url.host!=='app'||url.search||url.hash||!ASSETS.has(asset))return new Response('Not found',{status:404});
    const data=await fs.readFile(path.join(__dirname,asset));
    const type=asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':'text/html';
    return new Response(data,{headers:{'Content-Type':`${type}; charset=utf-8`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"}});
  });
  let migrationError='';
  try{await migrateLegacy();if(store.available())await backups.migrate();}catch(error){migrationError=error.message;}
  handle('app:get-meta',()=>({version:app.getVersion(),platform:process.platform}));
  handle('state:load',async()=>({content:await store.read(),encrypted:store.available(),migrationError}));
  handle('state:save',async content=>{await store.save(validatePayload(content));return {};});
  handle('backup:save',async content=>({name:await backups.save(validatePayload(content))}));
  handle('backup:list',async()=>({names:await backups.list()}));
  handle('backup:read',async name=>({content:validatePayload(await backups.read(name))}));
  handle('backup:erase',async()=>{if(!await confirm('Delete all organization backup files?','This removes retained snapshots from the app profile. It is not forensic secure erasure.'))return {ok:false,canceled:true};await backups.clear();return {};});
  handle('permissions:revoke',()=>{grants.clear();for(const {contents}of guests.values())contents.reload();return {};});
  handle('skills:github',async url=>{if(typeof url!=='string'||url.length>2000)throw new Error('Invalid URL.');return githubSkills(net.fetch,url);});
  handle('ollama:request',async payload=>{
    if(payload?.action==='models')return {data:await boundedJson(fetch,'http://127.0.0.1:11434/api/tags')};
    if(payload?.action!=='generate'||typeof payload.model!=='string'||!payload.model||payload.model.length>100||typeof payload.prompt!=='string'||payload.prompt.length>120000)throw new Error('Invalid local AI request.');
    return {data:await boundedJson(fetch,'http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:payload.model,prompt:payload.prompt,stream:false})})};
  });
  handle('provider:action',async payload=>{
    const guest=guests.get(payload?.guestId);
    if(!guest||guest.providerId!==payload.providerId||!['insert','extract','navigate'].includes(payload.action))throw new Error('Invalid provider action.');
    const {contents,providerId}=guest;
    if(payload.action==='navigate'){if(!Security.isProviderUrl(payload.url,providerId))throw new Error('Bookmark must belong to this provider.');await contents.loadURL(payload.url);return {};}
    if(!Security.isProviderUrl(contents.getURL(),providerId))throw new Error('Open a conversation on this provider first. Automation is unavailable on sign-in pages.');
    if(payload.action==='insert'){
      if(typeof payload.text!=='string'||!payload.text.trim()||payload.text.length>120000)throw new Error('Content must be between 1 and 120,000 characters.');
      if(!await confirm(`Share this text with ${byId[providerId].name}?`,`${payload.text.length} characters will be inserted into ${Security.origin(contents.getURL())}. The website can read or autosave it immediately, even before you press Send.`))return {ok:false,canceled:true};
    }
    if(!Security.isProviderUrl(contents.getURL(),providerId))throw new Error('Provider origin changed.');
    return {result:await contents.executeJavaScript(scriptFor(byId[providerId],payload.action,payload.text,payload.scope,Security.origin(contents.getURL())),true)};
  });
  handle('shell:open-external',openExternal);
  handle('session:clear',async partition=>{
    if(typeof partition!=='string'||!Security.PARTITION_PATTERN.test(partition)||!bindings.has(partition))throw new Error('Unknown session.');
    if(!await confirm('Clear this account’s browser session?',`This signs out the account and clears its provider storage and cache. ${byId[bindings.get(partition)].name}`))return {ok:false,canceled:true};
    const ses=accountSessions.get(partition);if(!ses)throw new Error('Open this account before clearing it.');await ses.clearStorageData();await ses.clearCache();grants.clear();for(const {contents}of guests.values())if(contents.session===ses)contents.reload();return {};
  });
  handle('dialog:save-export',async raw=>{
    const payload=Security.validateExport(raw);if(!payload)throw new Error('Invalid or oversized export.');
    const result=await dialog.showSaveDialog(appWindow,{title:'Export plaintext — protect this file',defaultPath:`${payload.name}.${payload.format}`,filters:[{name:payload.format.toUpperCase(),extensions:[payload.format]}]});
    if(result.canceled||!result.filePath)return {ok:false,canceled:true};await fs.writeFile(result.filePath,payload.content,{encoding:'utf8',mode:0o600});return {};
  });
  handle('dialog:open-import',async()=>{
    const result=await dialog.showOpenDialog(appWindow,{title:'Import JSON',properties:['openFile'],filters:[{name:'JSON',extensions:['json']}]});
    if(result.canceled||!result.filePaths[0])return {ok:false,canceled:true};const stat=await fs.stat(result.filePaths[0]);if(!stat.isFile()||stat.size>Security.MAX_EXPORT_BYTES)throw new Error('Invalid or oversized import.');return {content:await fs.readFile(result.filePaths[0],'utf8')};
  });
  // Encrypted state remembers account/provider bindings between launches.
  try{const saved=await store.read();if(saved)for(const workspace of Core.importPayload(saved).workspaces)for(const panel of workspace.panels)bindings.set(`persist:aicc-${panel.id}`,panel.providerId);}catch{/* Renderer presents storage errors without overwriting data. */}
  createWindow();initializing=false;app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{dialog.showErrorBox('AI Command Center could not start',error.message);app.quit();});
app.on('window-all-closed',()=>{if(!initializing&&process.platform!=='darwin')app.quit();});
let quitting=false;
app.on('before-quit',event=>{
  if(quitting)return;
  event.preventDefault();quitting=true;
  void Promise.all([store?.flush?.(),backups?.flush?.()]).finally(()=>app.quit());
});
