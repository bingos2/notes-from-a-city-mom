import {
  emitWelcomeOnce,
  registerNewsletterConsent,
  SubscriptionError,
  validEmail,
  requireWelcomeStore
} from './_newsletter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { email, consent, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true });

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!validEmail(normalizedEmail)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (consent !== true) return res.status(400).json({ error: 'Please confirm that you would like to receive the weekly notes.' });

  try {
    // Do not create a subscriber if the durable one-time Welcome guard is unavailable.
    requireWelcomeStore();
    const subscription = await registerNewsletterConsent(normalizedEmail, 'website-newsletter-form');

    if (subscription.newSubscription) {
      await emitWelcomeOnce({
        resend: subscription.resend,
        email: normalizedEmail,
        source: 'website-newsletter-form'
      });
    }

    return res.status(200).json({
      ok: true,
      alreadySubscribed: !subscription.newSubscription
    });
  } catch (error) {
    const status = error instanceof SubscriptionError ? error.statusCode : 502;
    console.error('Newsletter subscription error', { name: error?.name, message: error?.message });
    return res.status(status).json({ error: error?.message || 'Could not subscribe right now. Please try again.' });
  }
}
