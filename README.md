# FlipLens

FlipLens is a Next.js 15 UI for explaining secondhand marketplace listings with Google Gemini vision and structured analysis.

## Run locally

1. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.

Open [http://localhost:3000](http://localhost:3000) in your browser.

Optional production limits:

- `FLIPLENS_PER_IP_HOURLY_LIMIT` defaults to `10`.
- `FLIPLENS_GLOBAL_DAILY_LIMIT` defaults to `100` per running server process.

The Gemini key is read only by the server-side `/api/analyze` route. Screenshot inputs are sent to Google Gemini for multimodal analysis. On Gemini's free tier, Google may use submitted content to improve its products. For links, FlipLens uses the URL and any optional page text supplied by the user; it labels facts as uncertain when the listing content is unavailable rather than inventing details.

## Self-hosting

FlipLens runs as a standard Next.js Node server. The production files in `deploy/` provide:

- a systemd service bound to `127.0.0.1:8790`;
- an Nginx virtual host with body, request-rate, and connection limits;
- automatic recovery with a bounded restart policy;
- `/api/health`, which returns `200` only when analysis is configured.

Keep `GEMINI_API_KEY` in the server environment file, never in Git or client-side variables. `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Build with `npm ci && npm run lint && npm run build` before restarting production.
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
