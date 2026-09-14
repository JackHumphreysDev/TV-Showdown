import { randomInt } from 'node:crypto';

export const eligible = (item, filter = 'both') =>
  (filter === 'both' || item.kind === filter) &&
  (item.status === 'want' || (item.kind === 'series' && item.status === 'watching'));

export function draw(items) {
  if (!items.length) throw new Error('Cannot draw from an empty list');
  return items[randomInt(items.length)];
}

export const tokenHash = async (value) => {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(value).digest('hex');
};

export const inviteAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function inviteCode(length = 9) {
  return Array.from({ length }, () => inviteAlphabet[randomInt(inviteAlphabet.length)]).join('');
}
