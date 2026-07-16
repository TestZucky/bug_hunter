# Bug Hunter 🐛

An interactive debugging game. Inspect a code snippet, **find** the buggy line,
**diagnose** why it fails, and ship the **safe fix** before the timer runs out —
every wrong call is a real production incident.

Built as the **full MVP frontend** described in the Bug Hunter TDD, on top of the
Figma Make visual design. Game logic, state, scoring, and content are all real;
persistence is local (no backend in this phase).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run typecheck
```

## What's implemented

- **Full round loop**: Inspect → Find line → Diagnose → Fix → Result, driven by
  an explicit state machine (`src/stores/gameStore.ts`).
- **Game modes**: Classic (10 rounds, 3 lives, difficulty ladder), Production
  Emergency (endless, ends on system health), Daily Challenge (seeded, same set
  per day), Practice (no timer/lives, filter by language/difficulty/category).
- **Scoring**: base × accuracy × speed × combo multipliers, separate XP track,
  ranks, streaks — all per the TDD formulas (`src/lib/scoring.ts`, `ranks.ts`).
- **Feedback**: per-round explanation, correct fix, and a production-impact card;
  confetti, combo toast, shake, WebAudio blips, haptics.
- **Persistence**: XP, streak, best scores, and stats saved to `localStorage`
  (`userStore`, `settingsStore`).
- **Pages**: landing, play, daily, practice, leaderboard (local bots), profile.
- **Answer safety**: the UI only ever receives the answer-stripped
  `PublicChallenge` projection (`toPublicChallenge`), with options shuffled so the
  correct choice isn't always first.
- **Accessibility**: keyboard controls (arrows/Enter/1–4/Esc/Space), focus rings,
  ARIA roles, color-independent feedback, reduced-motion support.
- **Responsive**: desktop two-column, mobile single-column with sticky actions.

## Architecture

```
src/
  app/            Next.js App Router pages (/, /play, /daily, /practice, /leaderboard, /profile)
  components/
    game/         GameShell, CodeEditor, SidePanel, AnswerPanel, RoundResult, SessionSummary, …
    common/       PageHeader
  stores/         gameStore (state machine), userStore, settingsStore (Zustand)
  lib/            scoring, ranks, constants, syntax highlighter, cn
  services/       challengeService (selection, daily seed, public projection, grading)
  schemas/        Zod challenge schema + validator
  content/        challenge data (javascript.ts, python.ts) via a compact builder
  types/          shared TypeScript types
  hooks/          useTimer, useSound
```

## Tech

Next.js 15 · TypeScript · Tailwind v4 · Zustand · Zod · Motion (Framer) ·
lucide-react. Theme tokens ported from the Figma Make export.

## Content

29 hand-authored challenges (15 JavaScript/TS, 14 Python) across easy/medium/hard.
Adding more is pure data entry in `src/content/challenges/*.ts` — the Zod schema
validates every challenge at build time (unique line ids, exactly one correct
diagnosis and fix, valid bug lines). The TDD's launch target is 100+; this MVP
ships a playable set and the pipeline to grow it.

## Not in this phase (deferred to the TDD's backend phase)

Backend APIs, database, real auth, and a networked leaderboard. The code is
structured so a server can slot in behind `challengeService` / the stores without
UI changes — grading already runs against a "server-shaped" challenge object and
the client consumes only the sanitized projection.
