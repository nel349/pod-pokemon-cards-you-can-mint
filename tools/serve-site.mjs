// A local stand-in for POD's own file server, for checking the site before it is
// pushed. Nothing like this runs behind the delivered site: POD serves site/ as
// plain files. Run with: node tools/serve-site.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const port = Number(process.argv[2] || 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json',
  '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
};

const found = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [join(site, path), join(site, path, 'index.html'), `${join(site, path)}.html`]) {
    if (!candidate.startsWith(site)) break;
    if (await found(candidate)) {
      res.writeHead(200, { 'content-type': TYPES[extname(candidate)] || 'application/octet-stream' });
      res.end(await readFile(candidate));
      return;
    }
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
}).listen(port, () => console.log(`site/ on http://127.0.0.1:${port}`));
