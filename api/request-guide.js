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
      subject: "Your 15-month milestone guide is here!",
      html: `<!doctype html><html><body style="background:#fffaf2;color:#26374c;font-family:'Trebuchet MS',Verdana,Arial,sans-serif;margin:0;padding:32px 16px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;margin:auto"><tr><td style="padding:24px;background:#fff0c7;border-radius:18px"><h1 style="font-size:28px;margin:0 0 18px">My Toddler's Little Wins</h1><p style="font-size:15px;line-height:25px">Hi,</p><p style="font-size:15px;line-height:25px">Your little one is learning something new every day. Here's your free 15-month milestone guide based on the CDC checklist.</p><p style="margin:28px 0"><a href="${PDF_URL}" style="background:#17a66b;color:white;text-decoration:none;padding:14px 24px;border-radius:28px;font-weight:bold">Download A4 PDF</a></p><h2 style="font-size:20px">A little note, every week</h2><p style="font-size:15px;line-height:25px">One helpful parenting note in your inbox, once a week. Click below to opt in. One note a week, no spam.</p><p style="margin:26px 0"><a href="${subscribeUrl}" style="background:#ffe6a4;color:#26374c;text-decoration:none;padding:14px 22px;border-radius:28px;font-weight:bold">Yes, send me the weekly note</a></p><p style="font-size:12px">Notes from a City Mom</p></td></tr></table></body></html>`,
      text: `Your 15-month guide (A4): ${PDF_URL}\n\nWant a weekly parenting note? Opt in: ${subscribeUrl}`
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
