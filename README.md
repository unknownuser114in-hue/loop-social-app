# Loop · A little closer, every day

Loop is a small, working social web app for a first community. Its photo-led feed is inspired by familiar social apps, with its own name, artwork, and interface. It is not affiliated with Instagram or Facebook.

## Step 1 — Try the feed

Open the preview. It starts in demo mode, so you can explore without sharing an email. Open a story, follow someone, switch to **Following**, save a post to **Bookmarks**, or select **Create post**. Demo actions stay in this browser. The starter profiles, trending counts, and demo inbox are examples, not real users or messages.

## Step 2 — Try real accounts

Choose **Sign in → Create an account**. Your new account can post and comment publicly, edit its profile, and bookmark posts privately. Open a separate browser profile or private window and make a second account. In **Messages → New message**, choose that account, send a message, and look at the other window. Threads refresh every few seconds while open. You can also follow the second account and check its notifications. Use test credentials, not a password you use elsewhere.

## Step 3 — Understand the parts

- `src/components/`: The screens and buttons. React updates them when you act.
- `src/app/api/`: The endpoints that check who you are, accept uploads, and send or retrieve content.
- `src/lib/auth.ts`: Passwords are hashed with a random salt. A revocable cookie session keeps you signed in.
- `src/db/schema.ts`: PostgreSQL tables for accounts, posts, relationships, comments, uploads and messages, managed through Drizzle.
- `public/`: The built-in story and profile artwork, app imagery, and locally served font. The coffee photo is by Pixabay on [Pexels](https://www.pexels.com/photo/white-ceramic-mug-beside-eyeglasses-under-the-book-531876/); Inter is distributed under the SIL Open Font License in `public/fonts/`.

## Step 4 — Run it locally or publish a private beta

1. Install a current Node.js LTS and start a PostgreSQL database. Set `DATABASE_URL` in a local `.env` file and in your live host’s environment. Use a dedicated database and never commit credentials.
2. Run `npm install`, then `npx drizzle-kit push --config drizzle.config.ts` to create the Loop tables, then `npm run dev`. Open the local URL that Next.js prints. Leave `LOOP_SAMPLE_CONTENT` unset to load starter content, or set it to `false` before the first run against a fresh database to skip it.
3. Deploy as a **Node.js Next.js application**, not a static site. Apply the schema to the deployment database, build with `npm run build`, and serve behind HTTPS. Verify `/api/health` and repeat the two-account test on the deployed domain. This creates a shareable web app, not an App Store listing.
4. Before inviting the public, add email verification and a password reset flow, block and moderation tools with a review process, and backup/restore and account deletion procedures. Use durable object storage and media processing as uploads grow. The current beta uses PostgreSQL for small uploads (8 MB max), has an in-app reporting entry point but no moderator console, and does not end-to-end encrypt messages.

The next milestone is an invite-only beta with a trusted group, then email recovery and moderation before a public launch.
