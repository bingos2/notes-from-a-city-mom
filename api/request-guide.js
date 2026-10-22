import {
  makeWeeklyOptInUrl,
  registerGuideRequest,
  SubscriptionError,
  validEmail
} from './_newsletter.js';

const TEMPLATE_ID = process.env.RESEND_FREE_GUIDE_TEMPLATE_ID || '4c247693-1c61-49a0-a3c3-87f726baf4a8';
const SITE_URL = (process.env.SITE_URL || 'https://citymomnotes.com').replace(/\/$/, '');
const PDF_URL = process.env.LITTLE_WINS_A4_PDF_URL || `${SITE_URL}/downloads/My_Toddlers_Little_Wins_15_Months.pdf`;
const FROM = process.env.NCFM_FROM_EMAIL || 'Notes from a City Mom <hello@citymomnotes.com>';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { email, website } = req.body || {};
  if (website) return res.status(200).json({ ok: true });

  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!validEmail(normalizedEmail)) return res.status(400).json({ error: 'Please enter a valid email.' });

  try {
    // This performs only Free Guide membership. It does not grant newsletter consent.
    const { resend } = await registerGuideRequest(normalizedEmail);

    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: [normalizedEmail],
      template: {
        id: TEMPLATE_ID,
        variables: {
          A4_PDF_URL: PDF_URL,
          SIGNED_SUBSCRIBE_URL: makeWeeklyOptInUrl(normalizedEmail)
        }
      }
    });

    if (sendError) throw new SubscriptionError('We could not send the guide right now. Please try again.', 502);
    return res.status(200).json({ ok: true });
  } catch (error) {
    const status = error instanceof SubscriptionError ? error.statusCode : 502;
    console.error('Guide request error', { name: error?.name, message: error?.message });
    return res.status(status).json({ error: error?.message || 'We could not send the guide right now. Please try again.' });
  }
}
