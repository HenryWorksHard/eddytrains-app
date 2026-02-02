# EddyTrains - Client App

Mobile-first fitness app for EddyTrains clients.

## Features

- **Login** - Email/password authentication via Supabase
- **Dashboard** - Today's workout + assigned programs overview
- **Programs** - View all assigned programs with details
- **Schedule** - Weekly training schedule at a glance
- **Profile** - Account info and logout

## Tech Stack

- Next.js 15 (App Router)
- Tailwind CSS
- Supabase Auth & Database
- PWA-ready (add to home screen)

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Development

```bash
npm install
npm run dev
```

## Deployment

Deployed via Vercel with GitHub integration.
