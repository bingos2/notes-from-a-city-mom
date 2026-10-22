import crypto from 'node:crypto';
import { Resend } from 'resend';

export const SUBSCRIBERS_SEGMENT = 'bd5bd59f-ac17-48d2-b6e4-86f3a38d53dc';
export const FREE_GUIDE_SEGMENT = '6ef6a921-0a1f-41cd-9022-0fdf71ddcb0b';

export function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(String(value || ''));
}

export function isConflict(error) {
  return error?.statusCode === 409 || error?.name === 'conflict_error';
}

export function isNotFound(error) {
  return error?.statusCode === 404 || error?.name === 'not_found';
}

export class SubscriptionError extends Error {
  constructor(message, statusCode = 502) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new SubscriptionError('Subscriptions are being set up. Please try again soon.', 503);
  }
  return new Resend(process.env.RESEND_API_KEY);
}

async function getContact(resend, email) {
  const { data, error } = await resend.contacts.get({ email });
  if (error && !isNotFound(error)) throw new SubscriptionError('We could not verify this subscription. Please try again.', 502);
  return data || null;
}

function segmentsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.segments)) return data.segments;
  return [];
}

async function hasSegment(resend, email, segmentId) {
  // Segment membership can take a short moment to appear after a create/add call.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await resend.contacts.segments.list({ email });
    if (error) throw new SubscriptionError('We could not verify this subscription. Please try again.', 502);
    if (segmentsFrom(data).some((segment) => segment?.id === segmentId)) return true;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  return false;
}

async function addSegment(resend, email, segmentId) {
  const { error } = await resend.contacts.segments.add({ email, segmentId });
  if (error && !isConflict(error)) throw new SubscriptionError('We could not save this subscription. Please try again.', 502);
  if (!(await hasSegment(resend, email, segmentId))) {
    throw new SubscriptionError('We could not confirm this subscription. Please try again.', 502);
  }
}

async function updateSubscriptionStatus(resend, email, unsubscribed) {
  const { error } = await resend.contacts.update({ email, unsubscribed });
  if (error) throw new SubscriptionError('We could not update this subscription. Please try again.', 502);

  const updated = await getContact(resend, email);
  if (!updated || Boolean(updated.unsubscribed) !== unsubscribed) {
    throw new SubscriptionError('We could not confirm this subscription. Please try again.', 502);
  }
  return updated;
}

async function createContact(resend, email, { unsubscribed, segmentId }) {
  const { error } = await resend.contacts.create({
    email,
    unsubscribed,
    segmentIds: [segmentId]
  });
  if (error && !isConflict(error)) throw new SubscriptionError('We could not save this subscription. Please try again.', 502);
}

/**
 * Records a guide request only. This never changes newsletter consent or sends a welcome event.
 */
export async function registerGuideRequest(email) {
  const resend = getResend();
  let contact = await getContact(resend, email);

  if (!contact) {
    await createContact(resend, email, { unsubscribed: false, segmentId: FREE_GUIDE_SEGMENT });
    contact = await getContact(resend, email);
    if (!contact) throw new SubscriptionError('We could not save your request. Please try again.', 502);
  } else if (!(await hasSegment(resend, email, FREE_GUIDE_SEGMENT))) {
    await addSegment(resend, email, FREE_GUIDE_SEGMENT);
  }

  if (!(await hasSegment(resend, email, FREE_GUIDE_SEGMENT))) {
    throw new SubscriptionError('We could not confirm your guide request. Please try again.', 502);
  }

  return { resend, contact };
}

/**
 * Returns newSubscription only after actual Subscribers segment membership is confirmed.
 * This function is only called after explicit consent. That consent may re-subscribe
 * a globally-unsubscribed contact; ordinary guide requests never change that status.
 */
export async function registerNewsletterConsent(email, source) {
  if (!source) throw new SubscriptionError('Newsletter consent is required.', 400);

  const resend = getResend();
  let contact = await getContact(resend, email);
  const existed = Boolean(contact);

  if (contact?.unsubscribed) {
    contact = await updateSubscriptionStatus(resend, email, false);
  }

  const wasSubscriber = contact ? await hasSegment(resend, email, SUBSCRIBERS_SEGMENT) : false;

  if (!contact) {
    await createContact(resend, email, { unsubscribed: false, segmentId: SUBSCRIBERS_SEGMENT });
    contact = await getContact(resend, email);
    if (!contact || contact.unsubscribed) {
      throw new SubscriptionError('We could not confirm this subscription. Please try again.', 502);
    }
  } else if (!wasSubscriber) {
    await addSegment(resend, email, SUBSCRIBERS_SEGMENT);
  }

  const confirmedSubscriber = await hasSegment(resend, email, SUBSCRIBERS_SEGMENT);
  if (!confirmedSubscriber) {
    throw new SubscriptionError('We could not confirm this subscription. Please try again.', 502);
  }

  return { resend, contact, newSubscription: !wasSubscriber, existed };
}

function welcomeKey(email) {
  return 'ncfm:welcome:v1:' + crypto.createHash('sha256').update(email).digest('hex');
}

export function requireWelcomeStore() {
  kvConfig();
}

function kvConfig() {
  const url =
    process.env.NCFM_WELCOME_KV_REST_API_URL ||
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.NCFM_WELCOME_KV_REST_API_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new SubscriptionError('Newsletter delivery is being set up. Please try again soon.', 503);
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function kvRequest(path) {
  const { url, token } = kvConfig();
  const response = await fetch(url + path, { headers: { Authorization: 'Bearer ' + token } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new SubscriptionError('We could not complete the subscription safely. Please try again.', 502);
  return body.result;
}

/**
 * Atomically claims a contact's one-and-only welcome event before it is emitted.
 * An unknown/failed event response remains claimed to prevent duplicate welcomes.
 */
export async function emitWelcomeOnce({ resend, email, source }) {
  const key = welcomeKey(email);
  const claim = await kvRequest('/set/' + encodeURIComponent(key) + '/pending/NX/EX/315360000');
  if (claim !== 'OK') return { emitted: false, alreadyClaimed: true };

  const { error } = await resend.events.send({
    event: 'newsletter.subscribed',
    email,
    payload: { source, consent: true }
  });

  if (error) {
    await kvRequest('/set/' + encodeURIComponent(key) + '/event-uncertain/EX/315360000').catch(() => {});
    throw new SubscriptionError('Your subscription was saved, but we could not confirm the welcome email. Please contact hello@citymomnotes.com.', 502);
  }

  await kvRequest('/set/' + encodeURIComponent(key) + '/sent/EX/315360000');
  return { emitted: true, alreadyClaimed: false };
}

export function makeWeeklyOptInUrl(email) {
  const secret = process.env.SUBSCRIBE_TOKEN_SECRET;
  if (!secret) throw new SubscriptionError('Newsletter delivery is being set up. Please try again soon.', 503);
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
  const payload = `${email}.${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const base = (process.env.SITE_URL || 'https://citymomnotes.com').replace(/\/$/, '');
  return `${base}/weekly-note?e=${encodeURIComponent(email)}&x=${expires}&s=${encodeURIComponent(signature)}`;
}

export function verifyWeeklyOptIn({ email, expires, signature }) {
  const secret = process.env.SUBSCRIBE_TOKEN_SECRET;
  if (!email || !expires || !signature || !secret || !validEmail(email)) return null;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return null;
  const expected = crypto.createHmac('sha256', secret).update(`${email}.${expires}`).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  } catch {
    return null;
  }
  return String(email).trim().toLowerCase();
}
