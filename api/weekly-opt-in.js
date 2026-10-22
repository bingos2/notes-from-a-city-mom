import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';

function verifyToken(token) {
  const secret = process.env.NCFM_SUBSCRIBE_SECRET;
  if (!secret || !token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.email || !/^\S+@\S+\.\S+$/.test(data.email) || !Number.isFinite(data.exp) || Date.now() > data.exp) return null;
    return data.email.toLowerCase();
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const email = verifyToken(req.body?.token);
  if (!email) return res.status(400).json({ error: 'This subscription link is invalid or expired.' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: 'Subscriptions are not configured yet.' });
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const segmentId = 'bd5bd59f-ac17-48d2-b6e4-86f3a38d53dc';
    const { data: existing, error: lookupError } = await resend.contacts.get({ email });
    if (lookupError && lookupError.statusCode !== 404) {
      console.error('Contact lookup failed', lookupError);
      return res.status(502).json({ error: 'Could not subscribe. Please try again.' });
    }
    if (existing) {
      const { error: addError } = await resend.contacts.segments.add({ email, segmentId });
      if (addError) {
        console.error('Segment assignment failed', addError);
        return res.status(502).json({ error: 'Could not subscribe. Please try again.' });
      }
      if (existing.unsubscribed) {
        const { error: updateError } = await resend.contacts.update({ email, unsubscribed: false });
        if (updateError) {
          console.error('Subscription consent update failed', updateError);
          return res.status(502).json({ error: 'Could not subscribe. Please try again.' });
        }
      }
    } else {
      const { error: createError } = await resend.contacts.create({ email, unsubscribed: false, segments: [{ id: segmentId }] });
      if (createError) {
        console.error('Contact creation failed', createError);
        return res.status(502).json({ error: 'Could not subscribe. Please try again.' });
      }
    }
    return res.status(200).json({ ok: true });
  } catch { return res.status(500).json({ error: 'Could not subscribe. Please try again.' }); }
}
