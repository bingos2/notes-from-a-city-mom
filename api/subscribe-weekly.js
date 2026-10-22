import crypto from 'node:crypto';
import { Resend } from 'resend';

const SUBSCRIBER_SEGMENT = process.env.RESEND_SEGMENT_ID || 'bd5bd59f-ac17-48d2-b6e4-86f3a38d53dc';

function validEmail(value) {
  return /^\S+@\S+\.\S+$/.test(value);
}

function verify(email, expires, signature, secret) {
  if (!email || !expires || !signature || !secret || !validEmail(email)) return false;
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${email}.${expires}`).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function page(title, message, isSuccess = false) {
  const action = isSuccess
    ? '<a class="home-link" href="/">Back to Notes from a City Mom <span aria-hidden="true">→</span></a>'
    : '<a class="home-link" href="/tools/my-toddlers-little-wins-15-months">Back to the free guide <span aria-hidden="true">→</span></a>';

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta name="theme-color" content="#fffaf0">
      <title>${title} | Notes from a City Mom</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700;800&display=swap" rel="stylesheet">
      <style>
        :root{--ink:#071b3d;--cream:#fffaf0;--yellow:#ffcc32;--blue:#dceefa}
        *{box-sizing:border-box}
        body{min-height:100vh;margin:0;display:grid;place-items:center;padding:32px 20px;background:var(--cream);color:var(--ink);font-family:Nunito,Arial,sans-serif}
        .card{position:relative;width:min(100%,620px);overflow:hidden;padding:58px 62px 54px;border:2px solid var(--yellow);border-radius:28px;background:#fffdf8;text-align:center;box-shadow:9px 9px 0 rgba(7,27,61,.08)}
        .corner{position:absolute;width:145px;height:145px;border-radius:50%;background:var(--blue);opacity:.7}
        .corner.one{top:-83px;left:-65px}.corner.two{right:-84px;bottom:-92px;background:#fff0bb}
        .brand{position:relative;margin:0 0 45px;font:700 clamp(21px,3vw,27px)/1 Fredoka,sans-serif;letter-spacing:-1px}
        .spark{display:inline-block;width:17px;height:17px;margin-left:4px;vertical-align:2px;border-radius:50%;background:repeating-conic-gradient(from 5deg,transparent 0 14deg,var(--yellow) 15deg 19deg,transparent 20deg 45deg)}
        .stamp{position:relative;display:grid;place-items:center;width:68px;height:68px;margin:0 auto 25px;border:3px solid var(--ink);border-radius:50%;background:var(--yellow);font:700 33px/1 Fredoka,sans-serif}
        h1{position:relative;margin:0;color:var(--ink);font:700 clamp(38px,6vw,54px)/1.02 Fredoka,sans-serif;letter-spacing:-1.7px}
        p{position:relative;max-width:405px;margin:17px auto 30px;color:#45617b;font-size:18px;line-height:1.48;font-weight:700}
        .home-link{position:relative;display:inline-flex;gap:10px;align-items:center;padding:14px 18px;border:2px solid var(--ink);border-radius:12px;background:var(--ink);color:#fff;text-decoration:none;font-size:15px;font-weight:800;transition:transform .15s ease,background .15s ease,color .15s ease}
        .home-link:hover{transform:translate(-2px,-2px);background:var(--yellow);color:var(--ink);box-shadow:4px 4px 0 rgba(7,27,61,.18)}
        .home-link:active{transform:translate(0,0);box-shadow:none}
        @media(max-width:560px){body{padding:18px}.card{padding:43px 24px 39px;border-radius:22px}.brand{margin-bottom:36px;font-size:22px}.stamp{width:61px;height:61px;margin-bottom:21px;font-size:30px}h1{font-size:39px;letter-spacing:-1.3px}p{font-size:16px;margin-bottom:26px}.home-link{width:100%;justify-content:center}}
      </style>
    </head>
    <body>
      <main class="card">
        <span class="corner one" aria-hidden="true"></span><span class="corner two" aria-hidden="true"></span>
        <p class="brand">Notes from a City Mom<span class="spark" aria-hidden="true"></span></p>
        <div class="stamp" aria-hidden="true">${isSuccess ? '♥' : '!'}</div>
        <h1>${title}</h1>
        <p>${message}</p>
        ${action}
      </main>
    </body>
  </html>`;
}

export default async function handler(req, res) {
  const email = String(req.query.e || '').trim().toLowerCase();
  const expires = String(req.query.x || '');
  const signature = String(req.query.s || '');
  const secret = process.env.SUBSCRIBE_TOKEN_SECRET;

  if (!verify(email, expires, signature, secret)) {
    return res.status(400).send(page('That link has expired.', 'Please request the free guide again if you would still like to receive the weekly note.'));
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).send(page('We could not complete that yet.', 'Please try again in a little while.'));
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error: createError } = await resend.contacts.create({
      email,
      unsubscribed: false,
      segmentIds: [SUBSCRIBER_SEGMENT]
    });

    if (createError && createError.statusCode !== 409 && createError.name !== 'conflict_error') throw createError;

    if (createError) {
      const { error: segmentError } = await resend.contacts.segments.add({ email, segmentId: SUBSCRIBER_SEGMENT });
      if (segmentError && segmentError.statusCode !== 409 && segmentError.name !== 'conflict_error') throw segmentError;
    }

    return res.status(200).send(page('You’re on the list!', 'A little note for you will arrive in your inbox each week.', true));
  } catch (error) {
    console.error('Weekly subscription error', { name: error?.name, message: error?.message });
    return res.status(502).send(page('We could not complete that yet.', 'Please try again in a little while.'));
  }
}
