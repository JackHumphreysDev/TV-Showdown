import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(projectRoot, 'app/dist');
const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) throw new Error('Export the web app before building its offline shell.');

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const files = filesIn(dist)
  .filter((path) => !['metadata.json', 'sw.js'].includes(relative(dist, path)))
  .sort();
const paths = files.map((path) => `/${relative(dist, path).split(sep).join('/')}`);
for (const required of ['/index.html', '/manifest.json', '/pwa-icon-192.png', '/pwa-icon-512.png']) {
  if (!paths.includes(required)) throw new Error(`Missing PWA asset: ${required}`);
}

const html = readFileSync(indexPath, 'utf8');
if (!html.includes('</body>')) throw new Error('The exported HTML has no closing body tag.');
const registration = `<!-- tv-showdown-service-worker -->
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        console.warn('Offline shell could not be installed.');
      });
    });
  }
</script>`;
if (!html.includes('<!-- tv-showdown-service-worker -->')) {
  writeFileSync(indexPath, html.replace('</body>', `${registration}\n</body>`));
}

const digest = createHash('sha256');
for (const path of files) {
  digest.update(relative(dist, path));
  digest.update(readFileSync(path));
}
const cacheName = `tv-showdown-static-${digest.digest('hex').slice(0, 12)}`;
const worker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(paths)};
const PRECACHE_PATHS = new Set(PRECACHE_URLS);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME)
    .then((cache) => cache.addAll(PRECACHE_URLS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((names) => Promise.all(names
      .filter((name) => name.startsWith('tv-showdown-static-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match('/index.html')) || Response.error()));
  } else if (PRECACHE_PATHS.has(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(request)));
  }
});
`;
writeFileSync(join(dist, 'sw.js'), worker);
console.log(`PWA shell prepared with ${paths.length} static assets.`);
