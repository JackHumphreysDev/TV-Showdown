import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../app/dist');
const read = (name) => readFileSync(join(dist, name));

test('web export has a UK English install manifest and branded icons', () => {
  const manifest = JSON.parse(read('manifest.json').toString());
  assert.equal(manifest.name, 'TV Showdown');
  assert.equal(manifest.lang, 'en-GB');
  assert.equal(manifest.display, 'standalone');
  for (const size of [192, 512]) {
    const icon = read(`pwa-icon-${size}.png`);
    assert.equal(icon.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert(manifest.icons.some((entry) => entry.src === `/pwa-icon-${size}.png`));
  }
});

test('web export links the manifest and registers its service worker', () => {
  const html = read('index.html').toString();
  assert.match(html, /<html lang="en-GB">/);
  assert.match(html, /<link rel="manifest" href="\/manifest\.json"/);
  assert.match(html, /navigator\.serviceWorker\.register\('\/sw\.js'\)/);
});

test('service worker precaches the shell but no account or API data', () => {
  const worker = read('sw.js').toString();
  const match = worker.match(/const PRECACHE_URLS = (\[[^;]+\]);/);
  assert(match);
  const paths = JSON.parse(match[1]);
  assert(paths.includes('/index.html'));
  assert(paths.includes('/manifest.json'));
  assert(paths.some((path) => path.startsWith('/_expo/static/js/web/')));
  assert(paths.every((path) => !path.startsWith('/api/') && !path.includes('sqlite')));
  assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
});
