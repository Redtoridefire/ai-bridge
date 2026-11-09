'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const vm=require('node:vm');
const Core=require('../src/core');
const {scriptFor}=require('../src/provider-actions');
const {byId}=require('../src/providers');
const {privateStore}=require('../src/private-store');
const {backupStore}=require('../src/local-services');

test('imports reject attribute injection, duplicate identities, foreign providers, and pollution',()=>{
  const mutate=fn=>{const state=Core.defaultState();fn(state);return JSON.stringify(Core.exportPayload(state));};
  for(const raw of [mutate(s=>s.workspaces[0].panels[0].id='x" onload="bad'),mutate(s=>s.workspaces[0].panels[1].id=s.workspaces[0].panels[0].id),mutate(s=>s.workspaces[0].panels[0].providerId='evil'),mutate(s=>s.skills=[{id:'x',content:{html:'bad'}}]),'{"product":"AI Command Center","data":{"__proto__":{},"workspaces":[]}}'])assert.throws(()=>Core.importPayload(raw));
});
test('provider actions refuse changed origins and auth pages without touching the DOM',()=>{
  const script=scriptFor(byId.claude,'insert','secret',undefined,'https://claude.ai');
  for(const origin of ['https://chatgpt.com','https://accounts.google.com'])assert.throws(()=>vm.runInNewContext(script,{location:{origin}}),/origin changed/);
  const selected=scriptFor(byId.claude,'extract',undefined,'selection','https://claude.ai');
  assert.equal(vm.runInNewContext(selected,{location:{origin:'https://claude.ai'},window:{getSelection:()=> 'selected text'}}),'selected text');
});
test('encrypted persistence and legacy backup migration verify ciphertext; unavailable crypto fails closed',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'aicc-crypto-'));
  const key=crypto.randomBytes(32);
  // Test adapter exercises storage plumbing; actual OS safeStorage is used by the application.
  const osCrypto={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'test-protected',encryptString:text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]);},decryptString:buffer=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));decipher.setAuthTag(buffer.subarray(12,28));return Buffer.concat([decipher.update(buffer.subarray(28)),decipher.final()]).toString('utf8');}};
  try{
    const store=privateStore(root,osCrypto),payload=JSON.stringify(Core.exportPayload({...Core.defaultState(),notes:[{id:'note-one',title:'Sensitive',content:'private-needle'}]}));
    await store.save(payload);assert.equal(await store.read(),payload);
    assert.equal((await fs.readFile(path.join(root,'organization.enc.json'),'utf8')).includes('private-needle'),false);
    const directory=path.join(root,'backups');await fs.mkdir(directory);const legacy=path.join(directory,'backup-legacy.json');await fs.writeFile(legacy,payload);
    const backups=backupStore(directory,store);await backups.migrate();assert.equal((await fs.readFile(legacy,'utf8')).includes('private-needle'),false);assert.equal(await backups.read('backup-legacy.json'),payload);
    const locked=privateStore(root,{isEncryptionAvailable:()=>false});await assert.rejects(()=>locked.save(payload),/unavailable/);await assert.rejects(()=>locked.read(),/unavailable/);
    const basic=privateStore(root,{...osCrypto,getSelectedStorageBackend:()=> 'basic_text'});assert.equal(basic.available(),false);
    await backups.clear();assert.deepEqual(await backups.list(),[]);
  }finally{await fs.rm(root,{recursive:true});}
});
