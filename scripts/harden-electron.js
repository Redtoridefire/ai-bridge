'use strict';
// Official fuse API modifies only the installed development binary. Packaged
// binaries are independently hardened by electron-builder before signing.
async function main(){
  if(process.env.ELECTRON_SKIP_BINARY_DOWNLOAD==='1'){console.log('Binary download disabled for static CI; development fuse setup skipped.');return;}
  const {flipFuses,FuseVersion,FuseV1Options,getCurrentFuseWire}=require('@electron/fuses');
  const file=require('electron');
  const desired={
    [FuseV1Options.RunAsNode]:false,
    [FuseV1Options.EnableCookieEncryption]:true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:false,
    [FuseV1Options.EnableNodeCliInspectArguments]:false,
    // Legacy file-origin localStorage cannot be migrated when this is disabled.
    // Only the isolated, static migration page uses file://; the UI uses aicc://.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]:true,
  };
  const current=await getCurrentFuseWire(file);
  if(Object.entries(desired).some(([key,value])=>current[key]!==(value?49:48)))await flipFuses(file,{version:FuseVersion.V1,...desired});
  const verified=await getCurrentFuseWire(file);
  if(Object.entries(desired).some(([key,value])=>verified[key]!==(value?49:48)))throw new Error('Development Electron fuse verification failed.');
  console.log('Electron development security fuses verified (including OS cookie encryption).');
}
main().catch(error=>{console.error(`Electron hardening failed: ${error.message}. Close all AI Command Center windows and retry npm ci.`);process.exitCode=1;});
