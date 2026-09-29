# Notes from a City Mom

Independent content + newsletter site for **Notes from a City Mom**.

## Stack
- Static HTML/CSS/JS
- Vercel serverless function for newsletter signup
- Resend Contacts + Segments for subscriber storage
- Official Resend Node SDK in the subscribe function
- Notion for editorial workflow

## Vercel environment variables
Add these to the Vercel project:

- `RESEND_API_KEY`
- `RESEND_SEGMENT_ID`

Current newsletter segment:
- `Notes from a City Mom Subscribers`

The API key used by the website must be allowed to manage Contacts. A sending-only key cannot create subscribers.

Do not expose either value in client-side JavaScript or commit secrets to GitHub.

## Subscriber flow
1. Visitor submits an email on the website.
2. `/api/subscribe` validates the address server-side.
3. The Resend SDK creates the contact and assigns it to the newsletter segment.
4. Repeat signups return a friendly success response.
5. Welcome email and newsletter sending are configured separately after a sender domain is verified.

## Video source rule
YouTube is the canonical public video source for the website.
- Embed videos from the Notes from a City Mom YouTube channel.
- Link back to the original YouTube video/Short.
- Do not use the Higgsfield/CloudFront MP4 as the public website player once a YouTube URL exists.
- Companion notes and newsletters link back to the matching YouTube video.

Current Day 1 YouTube Short:
- https://youtube.com/shorts/zibNUc9BLy4

## Content workflow
- Video hub: `/watch`
- Browse by age: `/ages`
- Shorts/long-form companion notes: `/notes/`
- Newsletter archive: `/newsletters/`
- Editorial state: Notion

Newsletter workflow:
Draft → Expert Checked → human approval → send → Notion update.

Only the final newsletter send requires human approval.
