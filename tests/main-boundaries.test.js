'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const EventEmitter=require('node:events');

async function harness(){
  const root=path.resolve(__dirname,'..'),ipc=new Map(),sessions=new Map(),windows=[];
  let startup,response=0,executions=0;
  class Window extends EventEmitter{
    constructor(){super();this.webContents=new EventEmitter();this.webContents.mainFrame={url:'aicc://app/index.html'};this.webContents.setWindowOpenHandler=fn=>this.popup=fn;windows.push(this);}
    removeMenu(){} isDestroyed(){return false;} loadURL(){} static getAllWindows(){return windows;}
  }
  const electron={app:{whenReady:()=>({then:fn=>{startup=fn();return startup;}}),getPath:()=>'/tmp/aicc-no-existing-storage',getVersion:()=> 'test',on(){},quit(){}},BrowserWindow:Window,
    ipcMain:{handle:(channel,fn)=>ipc.set(channel,fn)},session:{fromPartition:partition=>{if(!sessions.has(partition)){const ses=new EventEmitter();ses.setPermissionCheckHandler=fn=>ses.check=fn;ses.setPermissionRequestHandler=fn=>ses.request=fn;sessions.set(partition,ses);}return sessions.get(partition);}},
    protocol:{registerSchemesAsPrivileged(){},handle(){}},safeStorage:{isEncryptionAvailable:()=>false},dialog:{showMessageBox:async()=>({response}),showErrorBox(){}},shell:{openExternal:async()=>{}},net:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'main.js'),'utf8'),{require:name=>name==='electron'?electron:name.startsWith('.')?require(path.resolve(root,name)):require(name),__dirname:root,process,Buffer,console,URL,Response});
  await startup;
  const window=windows[0],sender=window.webContents,event={sender,senderFrame:sender.mainFrame};
  function guest(partition='persist:aicc-a',url='https://claude.ai'){
    let blocked=false;const params={src:url,partition};sender.emit('will-attach-webview',{preventDefault(){blocked=true;}},{},params);
    assert.equal(blocked,false);
    const contents=new EventEmitter();contents.id=sessions.size;contents.session=sessions.get(params.partition);contents.getURL=()=>url;contents.isDestroyed=()=>false;contents.setWindowOpenHandler=()=>{};contents.executeJavaScript=async()=>{executions++;return 'PREPARED';};contents.stop=()=>{};contents.loadURL=async()=>{};
    sender.emit('did-attach-webview',{},contents);return contents;
  }
  return {ipc,event,sender,guest,sessions,setResponse:value=>response=value,getExecutions:()=>executions};
}
test('all privileged IPC rejects foreign webContents and subframes',async()=>{
  const h=await harness();assert.ok(h.ipc.size>=15);
  for(const handler of h.ipc.values()){
    assert.equal((await handler({sender:{mainFrame:{}},senderFrame:{url:'aicc://app/index.html'}})).ok,false);
    assert.equal((await handler({sender:h.sender,senderFrame:{url:'aicc://app/index.html'}})).ok,false);
  }
});
test('unavailable OS protection uses non-persistent provider partitions',async()=>{
  const h=await harness();h.guest();assert.ok([...h.sessions.keys()].every(partition=>!partition.startsWith('persist:')));
});
test('media defaults deny, rejects untrusted frames, requires approval and isolates grants per account',async()=>{
  const h=await harness(),guest=h.guest(),ses=guest.session;
  const request=details=>new Promise(resolve=>ses.request(guest,'media',resolve,details));
  const details={requestingUrl:'https://claude.ai',isMainFrame:true,mediaTypes:['audio']};
  assert.equal(await request(details),false);h.setResponse(1);
  assert.equal(await request({...details,requestingUrl:'https://evil.test'}),false);
  assert.equal(await request({...details,isMainFrame:false}),false);
  assert.equal(await request(details),true);
  assert.equal(ses.check(guest,'media','https://claude.ai',{isMainFrame:true,mediaType:'audio'}),true);
  const other=h.guest('persist:aicc-b');assert.equal(other.session.check(other,'media','https://claude.ai',{isMainFrame:true,mediaType:'audio'}),false);
});
test('insert cancellation prevents execution; redirects cannot cross provider boundary',async()=>{
  const h=await harness(),guest=h.guest(),payload={guestId:guest.id,providerId:'claude',action:'insert',text:'private'};
  const canceled=await h.ipc.get('provider:action')(h.event,payload);assert.equal(canceled.canceled,true);assert.equal(h.getExecutions(),0);
  h.setResponse(1);assert.equal((await h.ipc.get('provider:action')(h.event,payload)).result,'PREPARED');assert.equal(h.getExecutions(),1);
  let prevented=false;guest.emit('will-redirect',{preventDefault(){prevented=true;}},'https://chatgpt.com');assert.equal(prevented,true);
  assert.equal((await h.ipc.get('provider:action')(h.event,{...payload,action:'navigate',url:'https://evil.test'})).ok,false);
});
