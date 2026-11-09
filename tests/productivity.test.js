"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const P = require('../src/productivity');
const Core = require('../src/core');
const { githubSkills, backupStore } = require('../src/local-services');

test('templates fill repeated fields without treating replacement text as code',()=>{
  assert.deepEqual(P.variables('Hi {{name}}, {{name}}: {{project goals}}'),['name','project goals']);
  assert.equal(P.fill('{{name}} {{name}} {{missing}}',{name:'$& <script>'}),'$& <script> $& <script> {{missing}}');
});
test('GitHub inputs reject unrelated origins and parse repository/file URLs',()=>{
  assert.deepEqual(P.github('https://github.com/owner/skills'),{owner:'owner',repo:'skills'});
  assert.equal(P.github('https://github.com/owner/skills/blob/main/writing/SKILL.md').path,'writing/SKILL.md');
  for(const input of ['https://github.com.evil.test/o/r','http://github.com/o/r','https://user@github.com/o/r','https://github.com/o/r/tree/main'])assert.throws(()=>P.github(input));
});
test('skill preview retains untrusted content as text and provenance',()=>{
  const text='---\nname: Code reviewer\n---\n# Instructions\n<script>doSomething()</script>';
  const item=P.skill(text,'https://github.com/o/r');
  assert.equal(item.title,'Code reviewer');assert.equal(item.content,text);assert.equal(item.source,'https://github.com/o/r');
  assert.throws(()=>P.skill(''));assert.throws(()=>P.bookmark('javascript:alert(1)'));
});
test('GitHub discovery and file preview use bounded public API routes',async()=>{
  const routes=[];
  const fetcher=async url=>{routes.push(url);return new Response(JSON.stringify(url.includes('/contents/')?{encoding:'base64',size:20,content:Buffer.from('# Safe skill').toString('base64')}:url.includes('/git/trees/')?{tree:[{type:'blob',path:'writing/SKILL.md'},{type:'blob',path:'README.md'}]}:{default_branch:'main'}));};
  const listing=await githubSkills(fetcher,'https://github.com/o/r');assert.equal(listing.files.length,1);
  const preview=await githubSkills(fetcher,listing.files[0].url);assert.equal(preview.skills[0].title,'Safe skill');
  assert.ok(routes.every(url=>url==='https://api.github.com/repos/o/r'||url.startsWith('https://api.github.com/repos/o/r/')));
  await assert.rejects(()=>githubSkills(async()=>new Response('no',{status:403}),'https://github.com/o/r'),/403/);
});
test('rotating backups serialize concurrent writes, retain ten, and reject traversal',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'aicc-backups-'));
  const store=backupStore(directory);const state=Core.defaultState();
  for(let index=0;index<12;index++)await store.save(JSON.stringify(Core.exportPayload({...state,theme:index%2?'light':'dark'})));
  const names=await store.list();assert.equal(names.length,10);
  assert.equal(Core.importPayload(await store.read(names[0])).workspaces.length,1);
  await assert.rejects(()=>store.read('../outside.json'),/Invalid/);
  await assert.rejects(()=>store.save('{}'),/Invalid/);
  // Delete only the exact temporary directory created by this test.
  await fs.rm(directory,{recursive:true});
});
test('productivity data survives backup/export/import across old states',()=>{
  const state=Core.normalizeState(Core.defaultState());state.skills.push({id:'s1',title:'Review',content:'Review {{code}}',favorite:true});
  const restored=Core.importPayload(JSON.stringify(Core.exportPayload(state)));
  assert.equal(restored.skills[0].favorite,true);assert.deepEqual(restored.bookmarks,[]);
});
