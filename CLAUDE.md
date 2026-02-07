# CLAUDE.md — Fantasy BR 2.0

## Project Overview

Fantasy BR 2.0 is a real-time multiplayer fantasy football (soccer) application for the Brazilian league (Brasileirao 2026). Users draft players, manage lineups with tactical formations, trade players, and earn points based on real match performance data from API-Football.

The application lives in the `fantasy-br2/` subdirectory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5.x (strict mode) |
| UI | React 19.2.3 + Tailwind CSS 4.x |
| State | Zustand 5.0.11 |
| Backend | Firebase Realtime Database + Firebase Auth |
| External API | API-Football (api-sports.io) |
| Linting | ESLint 9 (flat config) with next/core-web-vitals + typescript |

## Directory Structure

```
fantasy-br2/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (metadata, viewport)
│   │   ├── page.tsx            # Main page (client-side app shell)
│   │   ├── globals.css         # Global styles + Tailwind imports
│   │   └── api/                # Server-side API routes
│   │       ├── scoring/        # POST — calculate round points from API-Football stats
│   │       ├── football/       # GET — proxy to API-Football (hides keys from client)
│   │       └── sync/           # GET — auto-sync players from API-Football to Firebase
│   ├── components/             # React components
│   │   ├── Navbar.tsx          # Top navigation bar
│   │   ├── BottomNav.tsx       # Bottom tab navigation (mobile)
│   │   ├── AuthGuard.tsx       # Auth wrapper & Firebase data loaders
│   │   ├── LoginScreen.tsx     # Login/Register form
│   │   └── screens/            # Feature screens (one per tab)
│   │       ├── HomeScreen.tsx        # Dashboard & next-match countdown
│   │       ├── LineupScreen.tsx      # Team formation editor (6 formations)
│   │       ├── DraftScreen.tsx       # Snake draft UI with real-time picks
│   │       ├── RankingScreen.tsx     # Leaderboard
│   │       ├── TradesScreen.tsx      # Player trade offers
│   │       ├── ChatScreen.tsx        # Global chat
│   │       └── AdminScreen.tsx       # Admin panel (scoring, sync, draft mgmt)
│   ├── lib/                    # Utilities & business logic
│   │   ├── firebase.ts         # Firebase client SDK initialization
│   │   ├── firebase-admin.ts   # Firebase REST API helpers (server-side)
│   │   ├── api-football.ts     # API-Football client with key rotation
│   │   ├── draft.ts            # Snake draft logic & types
│   │   ├── scoring.ts          # Points calculation rules & engine
│   │   └── appearance.ts       # Theme/appearance config types
│   └── store/
│       └── useStore.ts         # Zustand store (all client-side state)
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── next.config.ts
└── .env.example                # Required environment variables
```

## Commands

All commands run from the `fantasy-br2/` directory:

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Run production build
npm run lint     # Run ESLint (flat config, no args needed)
```

There is no test framework configured. No unit or integration tests exist.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values. Required variables:

- `NEXT_PUBLIC_FIREBASE_*` — Firebase client config (7 keys: API_KEY, AUTH_DOMAIN, DATABASE_URL, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID)
- `API_FOOTBALL_KEY_1`, `API_FOOTBALL_KEY_2`, `API_FOOTBALL_KEY_3` — Server-side only API-Football keys (rotated for rate limiting)
- `API_FOOTBALL_LEAGUE_ID` — Default `71` (Brazilian Serie A)
- `API_FOOTBALL_BASE_URL` — Default `https://v3.football.api-sports.io`

## Architecture & Patterns

### Single-Page App with Screen-Based Navigation
The app does **not** use Next.js file-based routing for user-facing pages. Instead, `page.tsx` renders a single client-side shell, and navigation is handled via Zustand state (`screen` property). The `BottomNav` component switches between screens. Screen types: `home`, `lineup`, `draft`, `ranking`, `trades`, `chat`, `admin`.

### Real-Time Data Flow
1. `AuthGuard` initializes Firebase `onValue()` listeners on mount
2. Listeners push updates into the Zustand store continuously
3. Screen components read from the store and render reactively
4. Writes go directly to Firebase via client SDK (`set()`)

### Server-Side API Routes
API routes in `src/app/api/` are the only server-side code. They:
- Proxy API-Football requests to hide API keys from the client
- Calculate scoring by fetching match stats and saving results to Firebase
- Sync player data from API-Football to Firebase with 24-hour caching

### Firebase Database Structure
Key paths in Firebase Realtime Database:
```
/users/{nickname}          — User profile, team, formation, budget, points
/gameData/players          — Player pool (all available players)
/draft                     — Draft state (status, picks, order, timer)
/gameState                 — Current round, status, countdown
/trades                    — Trade offers between users
/chat                      — Global chat messages
/config/appearance         — Theme/branding configuration
/scores/round_{n}          — Calculated round scores
/adminUids/{uid}           — Admin access whitelist
/nickToUid, /uidToNick     — User identity mappings
```

### State Management (Zustand)
All client state lives in `src/store/useStore.ts`. Key state slices:
- **Auth**: `user`, `isLoggedIn`, `isLoading`
- **Navigation**: `screen`
- **Game data**: `players`, `currentRound`, `roundStatus`, `nextGameDate`
- **Features**: `draft`, `trades`, `messages`, `unreadCount`
- **Theme**: `appearance` (colors, fonts, branding)

## Coding Conventions

### TypeScript
- Strict mode is enabled. All code must pass strict type checking.
- Path alias: `@/*` maps to `./src/*` (use `@/lib/firebase` not `../../lib/firebase`).
- All components use `'use client'` directive (client-side rendered).
- Interfaces over types for object shapes. Named exports preferred.

### Component Patterns
- Feature screens go in `src/components/screens/` as `XxxScreen.tsx`.
- Shared/layout components go in `src/components/`.
- Components read state from Zustand via `useStore()` hook.
- Firebase listeners are set up in `AuthGuard`, not in individual screens.
- Loading and empty states are handled inline within components.

### Styling
- Tailwind CSS utility classes exclusively — no CSS modules or styled-components.
- Dark theme defaults: `zinc-950` background, `zinc-900` cards, `zinc-800` borders.
- Accent palette: `emerald` (primary), `amber` (secondary/warnings), `red` (destructive).
- Mobile-first responsive design. Bottom navigation for app-like UX.
- `safe-area-inset-bottom` used for notch compatibility.

### Naming
- React components: `PascalCase` (`HomeScreen.tsx`)
- Utility functions/hooks: `camelCase` (`useStore`, `apiFootballFetch`)
- Constants: `UPPER_SNAKE_CASE` (`NAV_ITEMS`, `FORMATIONS`, `DEFAULT_SCORING`)
- Database paths: lowercase with underscores (`round_1`, `gameData`)
- Player positions: single-letter codes — `G` (goalkeeper), `D` (defender), `M` (midfielder), `A` (attacker)

### Language
- UI text is in **Portuguese (Brazilian)**.
- Code comments and variable names are in **English**.

## Scoring System

Points are calculated in `src/lib/scoring.ts` based on real match events:

| Event | Points |
|-------|--------|
| Goal (FWD / MID / DEF / GK) | 4 / 5 / 6 / 7 |
| Assist | 3 |
| Clean Sheet (DEF/GK) | 4 |
| Yellow Card | -1 |
| Red Card | -3 |
| GK Save | 0.5 |
| Penalty Scored (bonus) | +1 |
| Penalty Missed | -2 |
| Minutes 60+ / <60 | 2 / 1 |
| Goals Conceded (per 2, DEF/GK) | -1 |
| Own Goal | -2 |

Captain selection doubles the player's points for the round.

## Key Game Features

- **Snake Draft**: Players are drafted in snake order (1→N, then N→1). Configurable timer and rounds. Admin controls start/pause/reset.
- **6 Formations**: 4-3-3, 4-4-2, 3-5-2, 3-4-3, 5-3-2, 4-5-1. Lineup must be confirmed ("Cravar") before round starts.
- **Trading**: Create/accept/reject trade offers between users.
- **Chat**: Real-time global chat with unread badges.
- **Admin Panel**: Manage draft, trigger scoring, sync players from API-Football, edit appearance.

## Important Notes

- No test suite exists. Manual testing only.
- No CI/CD pipelines are configured.
- Firebase client SDK is used for real-time reads/writes; server-side uses REST API (`fetch`) to Firebase — there is no Firebase Admin SDK dependency.
- API-Football keys are rotated across 3 keys to handle rate limits.
- The app is designed for mobile-first but works on desktop.
