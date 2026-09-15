import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = process.env.API_URL || 'http://127.0.0.1:4000';
async function call(path, token, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.ok, true, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function expectStatus(path, token, expected, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, expected, `${method} ${path} should return ${expected}`);
}
const suffix = randomUUID().slice(0, 8);
const password = `test-password-${suffix}-only`;
const rachel = await call('/api/auth/register', null, 'POST', { email: `rachel-${suffix}@example.invalid`, password, name: 'Rachel' });
const regis = await call('/api/auth/register', null, 'POST', { email: `regis-${suffix}@example.invalid`, password, name: 'Regis' });
const rachelMe = await call('/api/me', rachel.token);
const regisMe = await call('/api/me', regis.token);
const group = await call('/api/groups', rachel.token, 'POST', { name: 'Film night test' });
const invite = await call(`/api/groups/${group.id}/invite`, rachel.token, 'POST');
const preview = await call(`/api/invites/${invite.code}`, null);
assert.equal(preview.name, 'Film night test');
await call('/api/groups/join', regis.token, 'POST', { code: invite.code });
const rachelFilm = await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel film', kind: 'movie' });
await call('/api/watchlist', rachel.token, 'POST', { title: 'Rachel series', kind: 'series' });
await call('/api/watchlist', regis.token, 'POST', { title: 'Regis film', kind: 'movie' });
const regisSeries = await call('/api/watchlist', regis.token, 'POST', { title: 'Regis series', kind: 'series' });
await call(`/api/watchlist/${regisSeries.id}`, regis.token, 'PATCH', { status: 'watching' });
const details = await call(`/api/groups/${group.id}`, regis.token);
assert.equal(details.members.length, 2);
assert.equal(details.watchlists.length, 4);
const selected = [rachelMe.profile_id, regisMe.profile_id];
const first = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', { selectedProfileIds: selected, filter: 'series', idempotencyKey: suffix });
assert.equal(first.result.kind, 'series');
const again = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', { selectedProfileIds: selected, filter: 'series', idempotencyKey: suffix });
assert.equal(again.id, first.id);
const accepted = await call(`/api/groups/${group.id}/accept`, regis.token, 'POST', { version: first.version });
assert.equal(accepted.state, 'accepted');
const history = await call(`/api/groups/${group.id}/history`, rachel.token);
assert.equal(history[0].resultState, 'accepted');
const watchedResult = await call(`/api/groups/${group.id}/spin`, rachel.token, 'POST', {
  selectedProfileIds: [rachelMe.profile_id], filter: 'movie', idempotencyKey: `watched-${suffix}`,
});
assert.equal(watchedResult.result.watchlistItemId, rachelFilm.id);
await expectStatus(`/api/watchlist/${watchedResult.result.watchlistItemId}`, regis.token, 404, 'PATCH', { status: 'watched' });
await call(`/api/watchlist/${watchedResult.result.watchlistItemId}`, rachel.token, 'PATCH', { status: 'watched' });
const updatedList = await call('/api/watchlist', rachel.token);
assert.equal(updatedList.find((item) => item.id === rachelFilm.id).status, 'watched');
const updatedGroup = await call(`/api/groups/${group.id}`, regis.token);
assert(!updatedGroup.watchlists.some((item) => item.id === rachelFilm.id));
const current = await call(`/api/groups/${group.id}/current`, regis.token);
assert.equal(current.result.watchlistItemId, rachelFilm.id);
console.log('API smoke test passed: separate accounts, invite, UK group, watchlists, eligible series, fair spin, shared acceptance and owner-only result completion.');
