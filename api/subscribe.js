export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const { email, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!apiKey || !audienceId) return res.status(503).json({ error: 'Subscriptions are being set up. Please try again soon.' });
  try {
    const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, unsubscribed: false })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 409) return res.status(200).json({ ok: true, alreadySubscribed: true });
      return res.status(502).json({ error: data.message || 'Could not subscribe right now.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Could not subscribe right now.' });
  }
}
