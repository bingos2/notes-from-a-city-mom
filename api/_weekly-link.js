import { createHmac } from 'node:crypto';

/**
 * Create a short-lived, signed email opt-in URL.
 * The token is generated server-side only; never expose NCFM_SUBSCRIBE_SECRET.
 */
export function makeWeeklyOptInUrl(email) {
  const secret = process.env.NCFM_SUBSCRIBE_SECRET;
  if (!secret || secret.length < 32) throw new Error('NCFM_SUBSCRIBE_SECRET must be set to a strong random value');
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error('Invalid email');
  const payload = Buffer.from(JSON.stringify({
    email: normalized,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return 'https://citymomnotes.com/weekly-note?token=' + encodeURIComponent(payload + '.' + signature);
}
