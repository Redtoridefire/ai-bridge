'use strict';
const assert=require('node:assert/strict');
const {evaluate}=require('./renderer-smoke');
async function main(){
  const targets=await fetch(`http://127.0.0.1:${process.env.CDP_PORT||9225}/json`).then(response=>response.json());
  const target=targets.find(item=>item.type==='page'&&item.url==='aicc://app/index.html');
  assert.ok(target,'Local app must be running.');
  const result=await evaluate(target.webSocketDebuggerUrl,`(()=>{
    document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
    document.querySelector('[data-add-provider="muse"]').click();
    const available=document.querySelector('#panel-provider').value==='muse';
    document.querySelector('#panel-label').value='Muse smoke test';
    document.querySelector('#panel-confirm').click();
    const panel=currentWorkspace().panels.find(item=>item.accountLabel==='Muse smoke test');
    const view=panel&&viewCache.get(panel.id);
    const restored=Core.importPayload(JSON.stringify(Core.exportPayload(state)));
    const output={available,added:!!panel,url:view?.getAttribute('src'),partition:view?.getAttribute('partition'),restored:restored.workspaces.some(workspace=>workspace.panels.some(item=>item.id===panel?.id&&item.providerId==='muse'))};
    currentWorkspace().panels=currentWorkspace().panels.filter(item=>item.id!==panel?.id);renderPanels();persist();renderChrome();
    return output;
  })()`);
  assert.equal(result.available,true);assert.equal(result.added,true);assert.equal(result.url,'https://muse.ai/');assert.match(result.partition,/^persist:aicc-panel-/);assert.equal(result.restored,true);
  console.log('Muse account selection, isolated panel, and workspace round-trip passed. Remote website/sign-in not verified.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
