import crypto from 'node:crypto';
import { Resend } from 'resend';

const SUBSCRIBER_SEGMENT = process.env.RESEND_SEGMENT_ID || 'bd5bd59f-ac17-48d2-b6e4-86f3a38d53dc';

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function verify(email, expires, signature, secret) {
  if (!email || !expires || !signature || !secret || !validEmail(email)) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${email}.${expires}`).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function page(title, message) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | Notes from a City Mom</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fffaf0;color:#071b3d;font-family:Arial,sans-serif}.card{max-width:460px;margin:24px;padding:42px 30px;text-align:center;border:2px solid #ffcc32;border-radius:22px;background:#fff}h1{margin:0 0 14px;font-size:34px;line-height:1.05}p{margin:0;font-size:17px;line-height:1.55}a{color:#071b3d;font-weight:700}</style><main class="card"><h1>${title}</h1><p>${message}</p></main></html>`;
}

export default async function handler(req, res) {
  const email = String(req.query.e || '').trim().toLowerCase();
  const expires = String(req.query.x || '');
  const signature = String(req.query.s || '');
  const secret = process.env.SUBSCRIBE_TOKEN_SECRET;

  if (!verify(email, expires, signature, secret)) {
    return res.status(400).send(page('That link has expired.', 'Please request the free guide again if you would still like to receive the weekly note.'));
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).send(page('We could not complete that yet.', 'Please try again in a little while.'));
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: createError } = await resend.contacts.create({
      email,
      unsubscribed: false,
      segmentIds: [SUBSCRIBER_SEGMENT]
    });

    if (createError && createError.statusCode !== 409 && createError.name !== 'conflict_error') throw createError;

    if (createError) {
      const { error: segmentError } = await resend.contacts.segments.add({ email, segmentId: SUBSCRIBER_SEGMENT });
      if (segmentError) throw segmentError;
    }

    return res.status(200).send(page('You’re subscribed!', 'A little note will arrive in your inbox each week.'));
  } catch (error) {
    console.error('Weekly subscription error', { name: error?.name, message: error?.message });
    return res.status(502).send(page('We could not complete that yet.', 'Please try again in a little while.'));
  }
}
