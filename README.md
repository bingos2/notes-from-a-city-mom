# Notes from a City Mom

Independent content + newsletter site for **Notes from a City Mom**.

## Stack
- Static HTML/CSS/JS
- Vercel serverless function for newsletter signup
- Resend Audience for subscriber storage

## Deploy
Import this GitHub repository in Vercel. Add:
- `RESEND_API_KEY`
- `RESEND_AUDIENCE_ID`

The site can deploy before those values are added; the subscribe form will show a setup message until they are configured.

## Content workflow
- Shorts/long-form companion notes: `/notes/`
- Newsletter archive: `/newsletters/`
- Subscriber capture: Resend Audience
- Editorial state: Notion

Only the final newsletter send requires human approval.
