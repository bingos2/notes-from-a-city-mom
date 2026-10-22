import crypto from 'node:crypto';
import { Resend } from 'resend';

const FREE_GUIDE_SEGMENT = process.env.RESEND_FREE_GUIDE_SEGMENT_ID || '6ef6a921-0a1f-41cd-9022-0fdf71ddcb0b';
const TEMPLATE_ID = process.env.RESEND_FREE_GUIDE_TEMPLATE_ID || 'ncfm-guide-15m-v10-a4';
const SITE_URL = (process.env.SITE_URL || 'https://citymomnotes.com').replace(/\/$/, '');
const PDF_URL = process.env.LITTLE_WINS_A4_PDF_URL || `${SITE_URL}/downloads/My_Toddlers_Little_Wins_15_Months.pdf`;

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function signedSubscribeUrl(email, secret) {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const payload = `${email}.${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${SITE_URL}/api/subscribe-weekly?e=${encodeURIComponent(email)}&x=${expires}&s=${encodeURIComponent(signature)}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { email, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true });

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!validEmail(normalizedEmail)) return res.status(400).json({ error: 'Please enter a valid email.' });

  const apiKey = process.env.RESEND_API_KEY;
  const signingSecret = process.env.SUBSCRIBE_TOKEN_SECRET;
  if (!apiKey || !signingSecret) {
    return res.status(503).json({ error: 'Guide delivery is being set up. Please try again soon.' });
  }

  const resend = new Resend(apiKey);
  try {
    const { error: createError } = await resend.contacts.create({
      email: normalizedEmail,
      unsubscribed: false,
      segmentIds: [FREE_GUIDE_SEGMENT]
    });

    if (createError && createError.statusCode !== 409 && createError.name !== 'conflict_error') {
      throw createError;
    }

    // Existing newsletter readers can request the guide too; keep both segments.
    if (createError) {
      const { error: segmentError } = await resend.contacts.segments.add({
        email: normalizedEmail,
        segmentId: FREE_GUIDE_SEGMENT
      });
      if (segmentError) throw segmentError;
    }

    const { error: sendError } = await resend.emails.send({
      from: 'Notes from a City Mom <hello@citymomnotes.com>',
      to: [normalizedEmail],
      template: {
        id: TEMPLATE_ID,
        variables: {
          A4_PDF_URL: PDF_URL,
          SIGNED_SUBSCRIBE_URL: signedSubscribeUrl(normalizedEmail, signingSecret)
        }
      }
    });

    if (sendError) throw sendError;
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Free guide delivery error', { name: error?.name, message: error?.message });
    return res.status(502).json({ error: 'We could not send the guide right now. Please try again.' });
  }
}
