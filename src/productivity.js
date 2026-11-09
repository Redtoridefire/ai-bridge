(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AICCProductivity = api;
})(globalThis, function() {
  'use strict';
  function variables(text) { return [...new Set([...text.matchAll(/\{\{\s*([\w -]+)\s*\}\}/g)].map(match => match[1].trim()))]; }
  function fill(text, values) { return text.replace(/\{\{\s*([\w -]+)\s*\}\}/g, (whole, key) => Object.hasOwn(values, key.trim()) ? values[key.trim()] : whole); }
  function skill(text, source = '') {
    if (typeof text !== 'string' || text.length > 250000 || !text.trim()) throw new Error('Skill must contain text and be at most 250,000 characters.');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const name = frontmatter?.[1].match(/^name:\s*(.+)$/m)?.[1]?.replace(/^["']|["']$/g, '') || text.match(/^#\s+(.+)$/m)?.[1] || 'Imported skill';
    return { title: name.slice(0, 100), content: text, source, favorite: false };
  }
  function github(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port) throw new Error('Use an HTTPS github.com repository or file URL.');
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (parts.length < 2 || !parts.slice(0,2).every(p => /^[\w.-]+$/.test(p))) throw new Error('Invalid GitHub repository.');
    if (parts.length === 2) return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
    if (parts[2] !== 'blob' || parts.length < 5) throw new Error('Use a repository URL or a GitHub blob file URL.');
    return { owner: parts[0], repo: parts[1], ref: parts[3], path: parts.slice(4).join('/') };
  }
  function bookmark(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Bookmarks require an HTTPS conversation URL.');
    return url.href;
  }
  return { variables, fill, skill, github, bookmark };
});
