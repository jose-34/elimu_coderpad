# KEMSAP CodeLive

A collaborative code-editor platform for KEMSAP's coding/robotics instructor
interviews: shared Monaco editor, in-browser Python/JavaScript execution,
embedded video, and a live scoring rubric, all in one URL per candidate.

This repo implements the **Tier 1 / MVP** slice of the full product brief
(see "Scope" below) as a working, runnable prototype — a base to iterate on
with real interview usage, not the complete 4–6 week / multi-developer build.

## What's implemented

- **Auth** — email/password registration & login, JWT access + refresh
  tokens, role field (`admin` / `interviewer` / `candidate`).
- **Interview sessions** — interviewers create a session (candidate name +
  email), get a unique 6-character join code, start/end the session.
- **Real-time collaborative editor** — Monaco Editor synced across
  interviewer and candidate via Socket.io (broadcast-based sync, debounced
  100ms). Good for the 1-2 concurrent editors an interview needs.
- **In-browser code execution** — no server-side sandbox required:
  - Python runs in a **Web Worker running Pyodide** (WASM CPython), so a
    runaway/looping submission can be killed client-side after a 15s
    timeout without freezing the tab. The 15s budget starts only once the
    runtime has loaded, so the one-off multi-megabyte Pyodide download is
    never mistaken for a hung program.
  - JavaScript runs in a sandboxed (`sandbox="allow-scripts"`) iframe with
    `console.*` captured and piped back via `postMessage`.
  - This is "Option A" from the original brief (offline-first, no Docker
    sandbox infra) — the right tradeoff for an MVP; see Scope below for the
    server-side Docker sandbox option if untrusted-network execution
    guarantees are ever needed.
- **Video** — Jitsi Meet embedded via the public `meet.jit.si` external API
  (one room per session code); point `JITSI_DOMAIN`/`VITE_JITSI_DOMAIN` at a
  self-hosted Jitsi instance for production use.
- **Assessment & scoring** — 16 seeded KEMSAP interview questions across
  5 sections (Scratch, Arduino, Python, Web Dev, Teaching), 0–4 star scoring
  per question with notes, auto-computed section/total scores, red flags,
  strengths/concerns, and an auto-calculated HIRE/CONSIDER/RISKY/PASS
  rating.
- **Candidate join flow** — a no-login `/join/:sessionCode` link with a
  name-entry "system check" step, countdown timer, editor, video, and the
  question list (no scoring UI — that's interviewer-only).
- **Dashboard** — interview list, candidate rankings sorted by score, and
  aggregate stats (total/this-week interviews, average score, hire rate).

> Note on question count: the original brief's section totals
> (12+12+12+12+16 = 64) only divide evenly across **16** four-point
> questions, not the "15" mentioned elsewhere in the brief. The seed data
> resolves that in favor of the section totals, which are what drive the
> rating.

## Runtime network dependencies

Monaco is **bundled** with the app (not loaded from a CDN), so the editor
works on a locked-down network and under a strict CSP. Two features do still
reach out to third-party CDNs at runtime:

| Feature | Host | If unreachable |
| --- | --- | --- |
| Python execution | `cdn.jsdelivr.net` (Pyodide) | Run shows "Could not load the Python runtime…" and re-enables; JS execution unaffected |
| Video | `meet.jit.si` (or your `JITSI_DOMAIN`) | Video panel stays blank; editor/scoring unaffected |

To run fully air-gapped, self-host a Jitsi instance and vendor the Pyodide
distribution into `frontend/public/`, then point `PYODIDE_VERSION` in
`frontend/public/pyodideWorker.js` at the local copy.

## Verification status

Verified end-to-end against a real PostgreSQL instance and two real Chromium
browser sessions (dev server **and** production build):

- Registration → login → dashboard → create session → open interview.
- **Bidirectional live sync** between an authenticated interviewer and an
  unauthenticated candidate, with no echo duplication, and the code snapshot
  persisted to the database.
- JavaScript execution (output + runtime errors surfaced).
- Scoring via the star UI: section subtotals, running total, rating badge,
  notes persisting across a reload, and red flags flipping the rating.
- Authorization: a second interviewer gets 403 on another's interview and an
  empty list; missing/invalid tokens get 401; unauthenticated sockets are
  rejected; input validation rejects out-of-range scores and bad emails.
- Deep-linking directly to `/interview/:id` and `/join/:code` in the
  production build (this is what `nginx.conf`'s SPA fallback exists for).

**Not verified here:** successful Python execution — the sandbox this was
built in blocks the Pyodide CDN. The *failure* path was verified (clear
error, Run re-enabled). Run one Python interview manually before first use.
Jitsi video is likewise unverified for the same reason. There is also no
automated test suite yet (see Scope below).

## Scope: deferred to Phase 2/3

Left out of this MVP pass — flagged rather than half-built:

- Interview **recording & playback** (FFmpeg/WebRTC recording, S3 storage,
  transcript, timeline scrubber).
- **Scheduled interviews** + email notifications (SendGrid/Mailgun),
  Slack integration.
- **Google OAuth** login (schema has a `googleId` field ready for it).
- **Export** (PDF/CSV/JSON) of results.
- **Multi-team/organization** support and admin user management UI.
- Server-side **Docker-sandboxed** code execution (only needed if code must
  run somewhere other than the participants' own browsers).
- Formal test suite (Jest/Cypress) and CI pipeline.
- CRDT-based (Yjs) editing — the current Socket.io broadcast sync is simpler
  and sufficient for the 2-4 participants a single interview has; Yjs is
  worth it if true offline-first / conflict-free editing becomes a
  requirement.

## Architecture

```
backend/   Node.js + Express + Socket.io + PostgreSQL (Prisma)
frontend/  React + Vite + TailwindCSS + Monaco Editor
```

Backend: JWT auth, REST API under `/api/v1`, Socket.io namespace for
real-time code sync and presence. See `backend/src/sockets/interviewSocket.js`
for the event contract (`interview:join`, `code:change`/`code:update`,
`cursor:move`/`cursor:update`, `user:joined`/`user:left`).

Frontend: Zustand for auth state, Axios with an automatic refresh-token
interceptor, React Router for `/login`, `/register`, `/dashboard`,
`/interview/:id` (interviewer), `/join/:sessionCode` (candidate).

## Local development

### Prerequisites
- Node.js 18+
- PostgreSQL 15 (or use `docker compose up db`)

### Backend
```bash
cd backend
cp .env.example .env   # edit DATABASE_URL / JWT secrets as needed
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev             # http://localhost:5000
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev              # http://localhost:5173
```

### Or everything via Docker Compose
```bash
docker compose up --build
# frontend: http://localhost:5173
# backend:  http://localhost:5000
```
(The backend container runs `prisma migrate deploy` on start; run the seed
script once against that database separately if you want the question bank
loaded: `docker compose exec backend npm run prisma:seed`.)

## Using it

1. Register an interviewer account at `/register`, then sign in.
2. From the dashboard, create an interview session (candidate name + email +
   language) — this returns a join link like `/join/ABC234`.
3. Send the candidate the join link. They enter their name and land in the
   editor + video + question list.
4. Open the same interview from the dashboard as the interviewer — you'll
   see the candidate's edits live, can run their code, join the same video
   room, and score each question as the interview progresses.
5. Click **Start interview** / **End interview** to track status and
   duration; save the final assessment (red flags, strengths, concerns) to
   lock in the HIRE/CONSIDER/RISKY/PASS rating.

## Security notes for a production rollout

- Rotate `JWT_SECRET`/`JWT_REFRESH_SECRET` and set real values before
  deploying — the `.env.example` defaults are dev-only placeholders.
- Put the app behind HTTPS/TLS (terminate at a reverse proxy/CDN); Socket.io
  and the Jitsi iframe both require secure contexts in production browsers.
- The candidate join flow is intentionally unauthenticated (session-code
  based) per the brief — session codes should be treated as bearer secrets
  (don't log them, don't put them in analytics).
