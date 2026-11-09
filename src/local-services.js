"use strict";
const fs = require('node:fs/promises');
const path = require('node:path');
const { github, skill } = require('./productivity');

async function boundedJson(fetcher, url, options = {}) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(options.method ? 120000 : 20000), redirect: 'error' });
  if (!response.ok) throw new Error(`Request failed (${response.status}). Check connectivity and service availability.`);
  const reader = response.body.getReader();
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 4 * 1024 * 1024) { await reader.cancel(); throw new Error('Response exceeds 4 MB.'); }
    chunks.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function githubSkills(fetcher, input) {
  const repo = github(input);
  const base = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'AI-Command-Center' };
  if (repo.path) {
    const file = await boundedJson(fetcher, `${base}/contents/${repo.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(repo.ref)}`, { headers });
    if (file.encoding !== 'base64' || file.size > 250000) throw new Error('Choose a text skill file smaller than 250 KB.');
    return { skills: [skill(Buffer.from(file.content, 'base64').toString('utf8'), input)] };
  }
  const info = await boundedJson(fetcher, base, { headers });
  const tree = await boundedJson(fetcher, `${base}/git/trees/${encodeURIComponent(info.default_branch)}?recursive=1`, { headers });
  const files = (tree.tree || []).filter(item => item.type === 'blob' && /(^|\/)SKILL\.md$/i.test(item.path));
  return { files: files.map(file => ({ path: file.path, url: `https://github.com/${repo.owner}/${repo.repo}/blob/${encodeURIComponent(info.default_branch)}/${file.path.split('/').map(encodeURIComponent).join('/')}` })), truncated: !!tree.truncated };
}

function backupStore(directory, codec = {encode: text=>text, decode: text=>text}) {
  let queue = Promise.resolve();
  return {
    flush:()=>queue.catch(()=>{}),
    async list() { await fs.mkdir(directory, { recursive: true }); return (await fs.readdir(directory)).filter(name => /^backup-[\w-]+\.json$/.test(name)).sort().reverse(); },
    save(content) {
      const operation = queue.catch(() => {}).then(async () => {
        if (typeof content !== 'string' || Buffer.byteLength(content) > 20 * 1024 * 1024) throw new Error('Backup must be JSON text under 20 MB.');
        const parsed = JSON.parse(content);
        if (parsed.product !== 'AI Command Center' || !Array.isArray(parsed.data?.workspaces)) throw new Error('Invalid backup data.');
        if (Buffer.byteLength(content) > 20 * 1024 * 1024) throw new Error('Backup exceeds 20 MB.');
        await fs.mkdir(directory, { recursive: true });
        const name = `backup-${new Date().toISOString().replace(/[^\dT]/g, '-')}-${require('node:crypto').randomUUID()}.json`;
        const file = path.join(directory, name);
        const encrypted=codec.encode(content);if(codec.decode(encrypted)!==content)throw new Error('Backup encryption verification failed.');
        await fs.writeFile(`${file}.tmp`, encrypted, { mode: 0o600 });
        await fs.rename(`${file}.tmp`, file);
        const names = (await fs.readdir(directory)).filter(n => /^backup-[\w-]+\.json$/.test(n)).sort().reverse();
        for (const old of names.slice(10)) await fs.unlink(path.join(directory, old));
        return name;
      });
      queue = operation; return operation;
    },
    async read(name) {
      if (typeof name !== 'string' || !/^backup-[\w-]+\.json$/.test(name)) throw new Error('Invalid backup name.');
      return codec.decode(await fs.readFile(path.join(directory, name), 'utf8'));
    },
    async migrate(){
      await fs.mkdir(directory,{recursive:true});
      for(const name of (await fs.readdir(directory)).filter(n=>/^backup-[\w-]+\.json$/.test(n))){
        const file=path.join(directory,name),text=await fs.readFile(file,'utf8');
        const parsed=JSON.parse(text);
        if(parsed.format==='aicc-encrypted-v1'){codec.decode(text);continue;}
        require('./core').importPayload(parsed);
        const encrypted=codec.encode(text);if(codec.decode(encrypted)!==text)throw new Error('Backup migration verification failed.');
        await fs.writeFile(`${file}.tmp`,encrypted,{mode:0o600});await fs.rename(`${file}.tmp`,file);
      }
    },
    async clear(){await queue.catch(()=>{});await fs.mkdir(directory,{recursive:true});for(const name of (await fs.readdir(directory)).filter(n=>/^backup-[\w-]+\.json(?:\.tmp)?$/.test(n)))await fs.unlink(path.join(directory,name));},
  };
}
module.exports = { githubSkills, backupStore, boundedJson };
