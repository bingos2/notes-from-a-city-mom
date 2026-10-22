import {
  emitWelcomeOnce,
  registerNewsletterConsent,
  SubscriptionError,
  verifyWeeklyOptIn,
  requireWelcomeStore
} from './_newsletter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const email = verifyWeeklyOptIn({
    email: req.body?.email,
    expires: req.body?.expires,
    signature: req.body?.signature
  });

  if (!email) {
    return res.status(400).json({ error: 'This subscription link is invalid or expired.' });
  }

  try {
    // Do not create a subscriber if the durable one-time Welcome guard is unavailable.
    requireWelcomeStore();
    // The POST is the explicit affirmative action; the email link alone never subscribes anyone.
    const subscription = await registerNewsletterConsent(email, 'guide-email-opt-in');

    if (subscription.newSubscription) {
      await emitWelcomeOnce({
        resend: subscription.resend,
        email,
        source: 'guide-email-opt-in'
      });
    }

    return res.status(200).json({ ok: true, alreadySubscribed: !subscription.newSubscription });
  } catch (error) {
    const status = error instanceof SubscriptionError ? error.statusCode : 502;
    console.error('Weekly opt-in error', { name: error?.name, message: error?.message });
    return res.status(status).json({ error: error?.message || 'We could not complete the subscription. Please try again.' });
  }
}
