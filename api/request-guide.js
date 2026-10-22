import { Resend } from 'resend';
import { makeWeeklyOptInUrl } from './_weekly-link.js';

const GUIDE_SEGMENT = '6ef6a921-0a1f-41cd-9022-0fdf71ddcb0b';
const PDF_URL = 'https://citymomnotes.com/downloads/My_Toddlers_Little_Wins_15_Months.pdf';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!process.env.RESEND_API_KEY || !process.env.NCFM_SUBSCRIBE_SECRET || !process.env.NCFM_FROM_EMAIL) {
    return res.status(503).json({ error: 'Guide delivery is being set up. Please try again soon.' });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const subscribeUrl = makeWeeklyOptInUrl(email);
    const { error: sendError } = await resend.emails.send({
      from: process.env.NCFM_FROM_EMAIL,
      to: [email],
      template: {
        id: '4c247693-1c61-49a0-a3c3-87f726baf4a8',
        variables: {
          A4_PDF_URL: PDF_URL,
          SIGNED_SUBSCRIBE_URL: subscribeUrl
        }
      }
    });
    if (sendError) {
      console.error('Guide email failed', sendError);
      return res.status(502).json({ error: 'Could not send the guide right now.' });
    }
    const { error: contactError } = await resend.contacts.create({ email, unsubscribed: true, segmentIds: [GUIDE_SEGMENT] });
    if (contactError && contactError.statusCode !== 409) {
      console.error('Guide contact registration failed', contactError);
      return res.status(502).json({ error: 'The guide was sent, but we could not save your request.' });
    }
    if (contactError?.statusCode === 409) {
      const { error: segmentError } = await resend.contacts.segments.add({ email, segmentId: GUIDE_SEGMENT });
      if (segmentError) console.error('Guide segment assignment failed', segmentError);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Guide request error', error);
    return res.status(500).json({ error: 'Could not send the guide right now.' });
  }
}
