import { Resend } from 'resend';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { email, website } = req.body || {};

  // Honeypot: quietly accept bot submissions without storing them.
  if (website) return res.status(200).json({ ok: true });

  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_SEGMENT_ID;

  if (!apiKey || !segmentId) {
    return res.status(503).json({
      error: 'Subscriptions are being set up. Please try again soon.'
    });
  }

  try {
    const resend = new Resend(apiKey);

    const { error } = await resend.contacts.create({
      email: normalizedEmail,
      unsubscribed: false,
      segmentIds: [segmentId]
    });

    if (error) {
      // Duplicate signups should still feel successful to the visitor.
      if (error.statusCode === 409 || error.name === 'conflict_error') {
        return res.status(200).json({ ok: true, alreadySubscribed: true });
      }

      console.error('Resend subscribe error', {
        name: error.name,
        statusCode: error.statusCode,
        message: error.message
      });

      return res.status(502).json({
        error: 'Could not subscribe right now. Please try again.'
      });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Subscribe function error', error);
    return res.status(500).json({
      error: 'Could not subscribe right now. Please try again.'
    });
  }
}
