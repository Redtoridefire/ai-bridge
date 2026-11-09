'use strict';
// Native Windows release-gate test; no adapter, account, or user data involved.
const {app,safeStorage}=require('electron');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {privateStore}=require('../src/private-store');
app.whenReady().then(async()=>{
  assert.equal(process.platform,'win32','Run this check on Windows.');
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'aicc-dpapi-'));
  try{
    const store=privateStore(directory,safeStorage);assert.equal(store.available(),true,'Windows OS encryption must be available.');
    const fixture='Synthetic Windows encryption fixture';await store.save(fixture);assert.equal(await store.read(),fixture);
    const disk=await fs.readFile(path.join(directory,'organization.enc.json'),'utf8');assert.equal(disk.includes(fixture),false);
    console.log('Native Windows safeStorage encrypted persistence passed.');
  }finally{await fs.rm(directory,{recursive:true});}
  app.exit(0);
}).catch(error=>{console.error(error.message);app.exit(1);});
