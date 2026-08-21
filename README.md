# StageReady Audition Studio

A Next.js application that helps musicians simulate auditions, record
performances, reflect on their playing, and track progress. Authentication is
provided by Supabase.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

Copy `.env.example` to `.env.local` and add your Supabase project values before
starting the app.

## Score scanning and playback

StageReady uses a separate Python service for optical music recognition:

1. The Next.js app uploads PNG/JPEG score images to `POST /v1/omr`.
2. The Render service runs [HOMR](https://github.com/liebharc/homr) and returns MusicXML.
3. The browser renders MusicXML with OpenSheetMusicDisplay.
4. `osmd-audio-player` plays the parsed score with an OSMD cursor.

### Run the OMR backend locally

The backend requires Python 3.11 and native ML/image dependencies. Docker is the recommended setup:

```bash
docker build -t stageready-omr ./backend
docker run --rm -p 10000:10000 -e ALLOWED_ORIGINS=http://localhost:3000 stageready-omr
```

Set the frontend environment variable in `.env.local`:

```bash
NEXT_PUBLIC_OMR_API_URL=http://localhost:10000
```

### Deploy the backend to Render

The repository includes [`render.yaml`](./render.yaml). Create a Render Blueprint from this repository and set `ALLOWED_ORIGINS` to the comma-separated production and preview origins that may call the API. Add the resulting Render service URL as `NEXT_PUBLIC_OMR_API_URL` in Vercel, then redeploy the frontend.

HOMR uses the AGPL-3.0 license. Keep the deployed service source and modifications available as required by that license. Its scans focus primarily on pitch and rhythm and may require manual correction.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: create a production Next.js build
- `npm run start`: run the production build
- `npm test`: run lint and a production build

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
