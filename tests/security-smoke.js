'use strict';
const assert=require('node:assert/strict');
const {evaluate}=require('./renderer-smoke');
async function main(){
  const targets=await fetch(`http://127.0.0.1:${process.env.CDP_PORT||9225}/json`).then(r=>r.json());
  const target=targets.find(item=>item.type==='page'&&item.url==='aicc://app/index.html');assert.ok(target,'Trusted custom app origin loaded');
  const result=await evaluate(target.webSocketDebuggerUrl,`(async()=>{
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    const storage=await bridge.loadState();
    const origin=location.origin;
    const hasNode=typeof window.require!=='undefined';
    const popups=[...document.querySelectorAll('webview')].some(view=>view.hasAttribute('allowpopups'));
    const handoffInsertsByDefault=document.querySelector('#handoff-try-insert').checked;
    let copies=0;const descriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard'),action=providerAction;
    try{
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{copies++;}}});
      providerAction=async()=> 'PREPARED';
      document.querySelector('[data-mode="compare"]').click();
      document.querySelectorAll('#compare-targets input').forEach(input=>input.checked=true);
      document.querySelector('#compare-prompt').value='Synthetic privacy check';
      await prepareComparison();
    }finally{providerAction=action;if(descriptor)Object.defineProperty(navigator,'clipboard',descriptor);else delete navigator.clipboard;}
    document.querySelector('[data-mode="independent"]').click();
    return {origin,hasNode,popups,handoffInsertsByDefault,copies,storageOk:storage.ok,encrypted:storage.encrypted,notice:document.querySelector('#privacy-status').textContent};
  })()`);
  assert.equal(result.origin,'aicc://app');assert.equal(result.hasNode,false);assert.equal(result.popups,false);assert.equal(result.handoffInsertsByDefault,false);assert.equal(result.copies,0);
  if(!result.encrypted)assert.match(result.notice,/locked/i);
  console.log('Electron privacy checks passed',JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
