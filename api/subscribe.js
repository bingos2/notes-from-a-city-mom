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
    const response = await fetch('https://api.resend.com/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: normalizedEmail,
        unsubscribed: false,
        segments: [{ id: segmentId }]
      })
    });

    const data = await response.json().catch(() => ({}));

    // A repeat signup should feel successful to the visitor.
    if (response.status === 409) {
      return res.status(200).json({ ok: true, alreadySubscribed: true });
    }

    if (!response.ok) {
      console.error('Resend subscribe error', response.status, data);
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
