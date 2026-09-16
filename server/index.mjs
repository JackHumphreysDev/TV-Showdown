import http from 'node:http';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { db, transaction } from './db.mjs';
import { eligible, draw, inviteCode } from './core.mjs';
import { searchTitles, availability } from './tmdb.mjs';

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || '127.0.0.1';
const appOrigin = process.env.APP_ORIGIN || 'http://localhost:8081';
const publicAppUrl = process.env.PUBLIC_APP_URL || appOrigin;
const inviteAttempts = new Map();
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const requiredText = (value, label, max = 120) => {
  const text = String(value || '').trim();
  if (!text || text.length > max) fail(400, `${label} must be 1–${max} characters`);
  return text;
};
const passwordHash = (password) => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
const validPassword = (password, stored) => {
  const [salt, expected] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
};
const one = (sql, ...args) => db.prepare(sql).get(...args);
const all = (sql, ...args) => db.prepare(sql).all(...args);
const run = (sql, ...args) => db.prepare(sql).run(...args);

function auth(request) {
  const token = request.headers.authorization?.replace(/^Bearer /i, '');
  if (!token) fail(401, 'Sign in to continue');
  const account = one(`SELECT a.id, a.email, p.id AS profile_id, p.name, p.colour, p.active
    FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN profiles p ON p.account_id=a.id
    WHERE s.token_hash=? AND s.expires_at > datetime('now')`, hash(token));
  if (!account) fail(401, 'Your session has expired. Sign in again.');
  return account;
}
function member(groupId, accountId) {
  const row = one(`SELECT g.id, g.name, g.region, g.owner_id, m.role FROM groups g
    JOIN memberships m ON m.group_id=g.id WHERE g.id=? AND m.account_id=?`, groupId, accountId);
  if (!row) fail(403, 'You are not a member of this group');
  return row;
}
function owner(groupId, accountId) {
  const group = member(groupId, accountId);
  if (group.role !== 'owner') fail(403, 'Only the group owner can do that');
  return group;
}
function groupDetails(groupId, accountId) {
  const group = member(groupId, accountId);
  const members = all(`SELECT a.id AS accountId, p.id AS profileId, p.name, p.colour, p.active, m.role
    FROM memberships m JOIN accounts a ON a.id=m.account_id JOIN profiles p ON p.account_id=a.id
    WHERE m.group_id=? ORDER BY m.joined_at`, groupId);
  const watchlists = all(`SELECT w.id, w.account_id AS accountId, p.id AS profileId, w.title, w.kind, w.year,
    w.tmdb_id AS tmdbId, w.poster_path AS posterPath, w.overview, w.status
    FROM watchlist w JOIN profiles p ON p.account_id=w.account_id JOIN memberships m ON m.account_id=w.account_id
    WHERE m.group_id=? AND (w.status='want' OR (w.kind='series' AND w.status='watching'))
    ORDER BY w.added_at DESC`, groupId);
  return { ...group, members, watchlists };
}
function sessionView(session) {
  if (!session) return null;
  const result = one(`SELECT * FROM spin_results WHERE session_id=? ORDER BY rowid DESC LIMIT 1`, session.id);
  const seen = all(`SELECT watchlist_item_id FROM spin_results WHERE session_id=?`, session.id).map((x) => x.watchlist_item_id);
  const snapshot = JSON.parse(session.eligible_snapshot);
  return {
    id: session.id, state: session.state, filter: session.filter, version: session.version,
    winnerProfileId: session.winner_profile_id, selectedProfiles: JSON.parse(session.selected_profiles),
    result: result && { ...result, tmdbId: result.tmdb_id, posterPath: result.poster_path },
    canSkip: session.state === 'active' && snapshot[session.winner_profile_id].some((item) => !seen.includes(item.id)),
    createdAt: session.created_at,
  };
}
function latestSession(groupId) {
  return sessionView(one(`SELECT * FROM spin_sessions WHERE group_id=? ORDER BY created_at DESC, rowid DESC LIMIT 1`, groupId));
}
function newSessionToken(accountId) {
  const token = randomBytes(32).toString('base64url');
  run(`INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,datetime('now','+30 days'))`, hash(token), accountId);
  return token;
}
function revokeGroupInvites(groupId) {
  run(`UPDATE invites SET revoked_at=CURRENT_TIMESTAMP WHERE group_id=? AND revoked_at IS NULL`, groupId);
}
function cancelGroupSpin(groupId) {
  run(`UPDATE spin_sessions SET state='cancelled', version=version+1 WHERE group_id=? AND state='active'`, groupId);
}
function limitInviteAttempts(request) {
  const address = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = inviteAttempts.get(address);
  const current = !entry || now - entry.started > 10 * 60_000 ? { started: now, count: 0 } : entry;
  current.count++;
  inviteAttempts.set(address, current);
  if (current.count > 20) fail(429, 'Too many invite attempts. Please try again later.');
}
function createResult(sessionId, profileId, item) {
  const profile = one('SELECT name FROM profiles WHERE id=?', profileId);
  run(`INSERT INTO spin_results(id,session_id,watchlist_item_id,profile_name,title,kind,year,tmdb_id,poster_path,overview)
    VALUES(?,?,?,?,?,?,?,?,?,?)`, randomUUID(), sessionId, item.id, profile.name, item.title, item.kind,
    item.year || null, item.tmdbId || null, item.posterPath || null, item.overview || null);
}
async function body(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 32768) fail(413, 'Request is too large');
  }
  try { return raw ? JSON.parse(raw) : {}; }
  catch { fail(400, 'Invalid JSON'); }
}
function send(response, status, value, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    Vary: 'Origin',
  });
  response.end(JSON.stringify(value));
}

async function route(request) {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  const method = request.method;
  if (method === 'GET' && path === '/api/health') return { name: 'TV Showdown', region: 'GB', ok: true };

  if (method === 'POST' && path === '/api/auth/register') {
    const data = await body(request);
    const email = requiredText(data.email, 'Email', 254).toLowerCase();
    const name = requiredText(data.name, 'Profile name', 60);
    const password = String(data.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email)) fail(400, 'Enter a valid email address');
    if (password.length < 12) fail(400, 'Use a password of at least 12 characters');
    if (one('SELECT id FROM accounts WHERE email=?', email)) fail(409, 'This email already has an account');
    const accountId = randomUUID();
    transaction(() => {
      run('INSERT INTO accounts(id,email,password_hash) VALUES(?,?,?)', accountId, email, passwordHash(password));
      run('INSERT INTO profiles(id,account_id,name) VALUES(?,?,?)', randomUUID(), accountId, name);
    });
    return { token: newSessionToken(accountId) };
  }
  if (method === 'POST' && path === '/api/auth/login') {
    const data = await body(request);
    const account = one('SELECT * FROM accounts WHERE email=?', String(data.email || '').trim().toLowerCase());
    if (!account || !validPassword(String(data.password || ''), account.password_hash)) fail(401, 'Email or password was not recognised');
    return { token: newSessionToken(account.id) };
  }
  if (method === 'GET' && path.startsWith('/api/invites/')) {
    limitInviteAttempts(request);
    const code = decodeURIComponent(path.slice('/api/invites/'.length)).toUpperCase();
    const invite = one(`SELECT g.id AS groupId, g.name, COUNT(m.account_id) AS memberCount FROM invites i
      JOIN groups g ON g.id=i.group_id JOIN memberships m ON m.group_id=g.id
      WHERE i.code_hash=? AND i.revoked_at IS NULL AND i.expires_at > datetime('now')
      GROUP BY g.id`, hash(code));
    if (!invite) fail(404, 'This invite is invalid or has expired');
    return invite;
  }

  const me = auth(request);
  if (method === 'GET' && path === '/api/me') return me;
  if (method === 'PATCH' && path === '/api/me') {
    const data = await body(request);
    const name = requiredText(data.name, 'Profile name', 60);
    run('UPDATE profiles SET name=? WHERE account_id=?', name, me.id);
    return { ...me, name };
  }
  if (method === 'POST' && path === '/api/auth/logout') {
    run('DELETE FROM sessions WHERE token_hash=?', hash(request.headers.authorization.replace(/^Bearer /i, '')));
    return { ok: true };
  }
  if (method === 'GET' && path === '/api/groups') {
    return all(`SELECT g.id, g.name, g.region, m.role, (SELECT COUNT(*) FROM memberships WHERE group_id=g.id) AS memberCount
      FROM groups g JOIN memberships m ON m.group_id=g.id WHERE m.account_id=? ORDER BY g.created_at DESC`, me.id);
  }
  if (method === 'POST' && path === '/api/groups') {
    const data = await body(request);
    const id = randomUUID();
    transaction(() => {
      run('INSERT INTO groups(id,owner_id,name,region) VALUES(?,?,?,?)', id, me.id, requiredText(data.name, 'Group name', 60), 'GB');
      run("INSERT INTO memberships(group_id,account_id,role) VALUES(?,?,'owner')", id, me.id);
    });
    return groupDetails(id, me.id);
  }
  if (method === 'POST' && path === '/api/groups/join') {
    limitInviteAttempts(request);
    const data = await body(request);
    const code = requiredText(data.code, 'Room code', 30).toUpperCase();
    const invite = one(`SELECT group_id FROM invites WHERE code_hash=? AND revoked_at IS NULL
      AND expires_at > datetime('now')`, hash(code));
    if (!invite) fail(404, 'This invite is invalid or has expired');
    run("INSERT OR IGNORE INTO memberships(group_id,account_id,role) VALUES(?,?,'member')", invite.group_id, me.id);
    return groupDetails(invite.group_id, me.id);
  }
  if (method === 'GET' && path === '/api/watchlist') {
    return all(`SELECT id,title,kind,year,tmdb_id AS tmdbId,poster_path AS posterPath,overview,status,added_at AS addedAt
      FROM watchlist WHERE account_id=? ORDER BY added_at DESC, rowid DESC`, me.id);
  }
  if (method === 'POST' && path === '/api/watchlist') {
    const data = await body(request);
    const title = requiredText(data.title, 'Title', 200);
    const kind = data.kind === 'movie' || data.kind === 'series' ? data.kind : fail(400, 'Choose movie or series');
    const tmdbId = Number.isSafeInteger(Number(data.tmdbId)) && Number(data.tmdbId) > 0 ? Number(data.tmdbId) : null;
    if (tmdbId && one('SELECT id FROM watchlist WHERE account_id=? AND kind=? AND tmdb_id=?', me.id, kind, tmdbId)) fail(409, 'Already on your watchlist');
    if (!tmdbId && one('SELECT id FROM watchlist WHERE account_id=? AND kind=? AND lower(title)=lower(?)', me.id, kind, title)) fail(409, 'Already on your watchlist');
    const id = randomUUID();
    run(`INSERT INTO watchlist(id,account_id,title,kind,year,tmdb_id,poster_path,overview)
      VALUES(?,?,?,?,?,?,?,?)`, id, me.id, title, kind, Number(data.year) || null, tmdbId,
      String(data.posterPath || '').slice(0, 200) || null, String(data.overview || '').slice(0, 1500) || null);
    return one('SELECT * FROM watchlist WHERE id=?', id);
  }
  const itemMatch = path.match(/^\/api\/watchlist\/([\w-]+)$/);
  if (itemMatch && method === 'PATCH') {
    const data = await body(request);
    if (!['want', 'watching', 'watched'].includes(data.status)) fail(400, 'Invalid watchlist status');
    if (!one('SELECT id FROM watchlist WHERE id=? AND account_id=?', itemMatch[1], me.id)) fail(404, 'Title not found');
    run('UPDATE watchlist SET status=? WHERE id=?', data.status, itemMatch[1]);
    return { ok: true };
  }
  if (itemMatch && method === 'DELETE') {
    if (!one('SELECT id FROM watchlist WHERE id=? AND account_id=?', itemMatch[1], me.id)) fail(404, 'Title not found');
    run('DELETE FROM watchlist WHERE id=?', itemMatch[1]);
    return { ok: true };
  }
  if (method === 'GET' && path === '/api/search') return searchTitles(requiredText(url.searchParams.get('q'), 'Search', 120));
  if (method === 'GET' && path === '/api/availability') {
    const kind = url.searchParams.get('kind');
    const id = Number(url.searchParams.get('tmdbId'));
    if (!['movie', 'series'].includes(kind) || !Number.isSafeInteger(id) || id <= 0) fail(400, 'Invalid title');
    return availability(kind, id);
  }

  const groupMatch = path.match(/^\/api\/groups\/([\w-]+)(?:\/(.*))?$/);
  if (!groupMatch) fail(404, 'Not found');
  const groupId = groupMatch[1];
  const action = groupMatch[2] || '';
  if (method === 'GET' && !action) return groupDetails(groupId, me.id);
  if (method === 'GET' && action === 'current') { member(groupId, me.id); return latestSession(groupId); }
  if (method === 'GET' && action === 'history') {
    member(groupId, me.id);
    return all(`SELECT ss.id, ss.state, ss.created_at AS createdAt, sr.profile_name AS winnerName,
      sr.title, sr.kind, sr.year, sr.poster_path AS posterPath, sr.overview, sr.state AS resultState
      FROM spin_sessions ss JOIN spin_results sr ON sr.session_id=ss.id
      WHERE ss.group_id=? AND sr.rowid=(SELECT MAX(rowid) FROM spin_results WHERE session_id=ss.id)
      ORDER BY ss.rowid DESC LIMIT 30`, groupId);
  }
  if (method === 'POST' && action === 'invite') {
    owner(groupId, me.id);
    const code = inviteCode();
    run(`INSERT INTO invites(code_hash,group_id,expires_at) VALUES(?,?,datetime('now','+7 days'))`, hash(code), groupId);
    return { code, expiresInDays: 7, link: `${publicAppUrl.replace(/\/$/, '')}/?join=${code}`, nativeLink: `tvshowdown://join?code=${code}` };
  }
  if (method === 'DELETE' && action === 'invites') {
    owner(groupId, me.id); revokeGroupInvites(groupId); return { ok: true };
  }
  if (method === 'PATCH' && !action) {
    owner(groupId, me.id);
    const data = await body(request);
    const name = requiredText(data.name, 'Group name', 60);
    run('UPDATE groups SET name=? WHERE id=?', name, groupId);
    return groupDetails(groupId, me.id);
  }
  if (method === 'POST' && action === 'transfer') {
    owner(groupId, me.id);
    const data = await body(request);
    const target = requiredText(data.accountId, 'Account');
    if (!one('SELECT account_id FROM memberships WHERE group_id=? AND account_id=?', groupId, target)) fail(404, 'Member not found');
    transaction(() => {
      run('UPDATE groups SET owner_id=? WHERE id=?', target, groupId);
      run("UPDATE memberships SET role='member' WHERE group_id=? AND account_id=?", groupId, me.id);
      run("UPDATE memberships SET role='owner' WHERE group_id=? AND account_id=?", groupId, target);
    });
    return { ok: true };
  }
  if (method === 'DELETE' && action === 'members/me') {
    const group = member(groupId, me.id);
    if (group.role === 'owner') fail(409, 'Transfer ownership before leaving');
    transaction(() => { run('DELETE FROM memberships WHERE group_id=? AND account_id=?', groupId, me.id); cancelGroupSpin(groupId); });
    return { ok: true };
  }
  const removeMatch = action.match(/^members\/([\w-]+)$/);
  if (method === 'DELETE' && removeMatch) {
    owner(groupId, me.id);
    if (removeMatch[1] === me.id) fail(400, 'Transfer ownership before leaving');
    transaction(() => {
      run('DELETE FROM memberships WHERE group_id=? AND account_id=?', groupId, removeMatch[1]);
      revokeGroupInvites(groupId);
      cancelGroupSpin(groupId);
    });
    return { ok: true };
  }
  if (method === 'DELETE' && !action) {
    owner(groupId, me.id);
    run('DELETE FROM groups WHERE id=?', groupId);
    return { ok: true };
  }
  if (method === 'POST' && action === 'spin') {
    const group = groupDetails(groupId, me.id);
    const data = await body(request);
    const key = requiredText(data.idempotencyKey, 'Action key', 100);
    const prior = one('SELECT id FROM spin_sessions WHERE group_id=? AND creator_id=? AND idempotency_key=?', groupId, me.id, key);
    if (prior) return sessionView(one('SELECT * FROM spin_sessions WHERE id=?', prior.id));
    const filter = ['both', 'movie', 'series'].includes(data.filter) ? data.filter : 'both';
    const selected = Array.isArray(data.selectedProfileIds) ? [...new Set(data.selectedProfileIds)] : [];
    if (!selected.length) fail(400, 'Select at least one profile');
    const snapshot = {};
    for (const profileId of selected) {
      const profile = group.members.find((m) => m.profileId === profileId && m.active);
      if (!profile) fail(400, 'A selected profile is not an active group member');
      const items = group.watchlists.filter((item) => item.profileId === profileId && eligible(item, filter));
      if (!items.length) fail(400, `${profile.name} has no eligible titles for this spin`);
      snapshot[profileId] = items;
    }
    const winner = draw(selected);
    const chosen = draw(snapshot[winner]);
    const sessionId = randomUUID();
    transaction(() => {
      run("UPDATE spin_sessions SET state='superseded',version=version+1 WHERE group_id=? AND state='active'", groupId);
      run(`INSERT INTO spin_sessions(id,group_id,creator_id,idempotency_key,filter,selected_profiles,eligible_snapshot,winner_profile_id)
        VALUES(?,?,?,?,?,?,?,?)`, sessionId, groupId, me.id, key, filter, JSON.stringify(selected), JSON.stringify(snapshot), winner);
      createResult(sessionId, winner, chosen);
    });
    return latestSession(groupId);
  }
  if (method === 'POST' && (action === 'skip' || action === 'accept')) {
    member(groupId, me.id);
    const data = await body(request);
    const session = one("SELECT * FROM spin_sessions WHERE group_id=? AND state='active' ORDER BY rowid DESC LIMIT 1", groupId);
    if (!session) fail(409, 'There is no active spin');
    if (Number(data.version) !== session.version) fail(409, 'The group result changed. Refresh and try again.');
    const current = one("SELECT * FROM spin_results WHERE session_id=? AND state='pending' ORDER BY rowid DESC LIMIT 1", session.id);
    if (!current) fail(409, 'The current result is no longer pending');
    if (action === 'accept') {
      transaction(() => {
        run("UPDATE spin_results SET state='accepted' WHERE id=?", current.id);
        run("UPDATE spin_sessions SET state='accepted',version=version+1 WHERE id=?", session.id);
      });
    } else {
      const snapshot = JSON.parse(session.eligible_snapshot)[session.winner_profile_id];
      const seen = all('SELECT watchlist_item_id FROM spin_results WHERE session_id=?', session.id).map((x) => x.watchlist_item_id);
      const remaining = snapshot.filter((item) => !seen.includes(item.id));
      if (!remaining.length) fail(409, 'No other titles left for this profile. Spin again.');
      transaction(() => {
        run("UPDATE spin_results SET state='skipped' WHERE id=?", current.id);
        createResult(session.id, session.winner_profile_id, draw(remaining));
        run('UPDATE spin_sessions SET version=version+1 WHERE id=?', session.id);
      });
    }
    return latestSession(groupId);
  }
  fail(404, 'Not found');
}

http.createServer(async (request, response) => {
  const origin = request.headers.origin === appOrigin ? appOrigin : 'null';
  if (request.method === 'OPTIONS') return send(response, 204, {}, origin);
  try {
    const value = await route(request);
    send(response, 200, value, origin);
  } catch (error) {
    const status = error.status || 500;
    if (status === 500) console.error(error);
    send(response, status, { error: status === 500 ? 'Something went wrong. Please try again.' : error.message }, origin);
  }
}).listen(port, host, () => console.log(`TV Showdown API listening on http://${host}:${port}`));
