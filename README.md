# DOODI (ดูดี) — Movie Review

ชุมชนรีวิวหนังภาษาไทย: อ่านรีวิว เปรียบเทียบคะแนน และบันทึกหนังที่อยากดู

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · MySQL 8.4 + Prisma 7 · Zod · Argon2id

## Quick start

Requirements: Node.js 20+ (developed on 24), Docker (for MySQL).

```bash
npm install
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
docker compose up -d          # MySQL on 127.0.0.1:3307, waits until healthy below
npm run db:deploy             # apply migrations
npm run db:seed               # demo catalog, users, reviews (safe to re-run)
npm run dev                   # http://localhost:3000
```

`docker compose up -d --wait` blocks until the database is healthy if you prefer a single command.

The compose file also creates `doodi_shadow` (used by `prisma migrate dev`) and `doodi_test` (used by the tests).
It only runs on a fresh volume; if you already had a volume from an earlier run, recreate it with `docker compose down -v`.

## Demo credentials (development only)

Created by `npm run db:seed`. **Never seed these into a real deployment.**

| Role   | Email               | Password     |
| ------ | ------------------- | ------------ |
| Admin  | admin@doodi.test    | `Doodi!2345` |
| Member | member@doodi.test   | `Doodi!2345` |
| Member | mali@doodi.test     | `Doodi!2345` |
| Member | nat@doodi.test      | `Doodi!2345` |

Public registration always creates a `member`. The only way to get an admin is the seed (or editing the `users.role` column directly).

## Scripts

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | Dev server                                                       |
| `npm run build` / `start` | Production build / server                                     |
| `npm run lint`         | ESLint                                                           |
| `npm run typecheck`    | `tsc --noEmit`                                                   |
| `npm test`             | Vitest API/DB tests against `TEST_DATABASE_URL` (wipes that DB)  |
| `npm run test:e2e`     | Browser smoke test against a running server (needs Edge/Chrome)  |
| `npm run db:migrate`   | `prisma migrate dev` (create/apply migrations while developing)  |
| `npm run db:deploy`    | `prisma migrate deploy` (apply existing migrations)              |
| `npm run db:seed`      | Idempotent demo data                                             |
| `npm run db:reset`     | **Destroys** the dev database and reapplies migrations            |

`npm run test:e2e` signs up a new throwaway member and creates then soft-deletes a movie in whatever database the server uses, so run it against a dev database only.

## TMDB import (optional)

The site is fully usable without TMDB. Without a token the admin **นำเข้าจาก TMDB** tab shows a configuration message and the API answers `503 tmdb_not_configured`; nothing is faked.

1. Create a free account at <https://www.themoviedb.org/> and request API access under Settings → API.
2. Copy the **API Read Access Token** (the long `eyJ…` value, not the short API key).
3. Put it in `.env`: `TMDB_API_READ_ACCESS_TOKEN=eyJ...` and restart the server.

The token is read only on the server and never sent to the browser. Imports prefer Thai metadata (`th-TH`) and fall back to English for a missing title or synopsis. Posters use TMDB's `w500` images. The footer and admin page carry TMDB's required attribution; ratings shown on the site are always DOODI community ratings, never TMDB's.

## Data model

Tables and columns follow the project's database diagram (`users`, `movies`, `reviews`, `watchlists`), plus a `sessions` table for authentication.

- `reviews`: unique `(user_id, movie_id)`; rating is `TINYINT` with a database `CHECK (rating BETWEEN 1 AND 5)` (added in a hand-written migration because Prisma cannot express CHECK constraints).
- `watchlists`: composite primary key `(user_id, movie_id)`.
- `movies.deleted_at`: soft delete. Every public query filters it out; rows, reviews and watchlist entries are kept.
- `sessions`: stores a SHA-256 hash of the cookie token, so a leaked table cannot be replayed.

## REST API (`/api/v1`)

Success bodies are `{ "data": ... }` (lists add `"meta": { page, page_size, total, total_pages }`). Errors are `{ "error": { "code", "message", "fields"? } }`. `204` responses have no body.

| Method | Path                           | Access        | Success |
| ------ | ------------------------------ | ------------- | ------- |
| POST   | `/auth/register`               | Guest         | 201     |
| POST   | `/auth/login`                  | Guest         | 200     |
| POST   | `/auth/logout`                 | Any           | 204     |
| GET    | `/auth/me`                     | Member/Admin  | 200 (401 if signed out) |
| GET    | `/movies`                      | Public        | 200 — `q`, `genre`, `year`, `sort=newest\|top_rated\|most_reviewed`, `page`, `page_size` (max 50) |
| GET    | `/movies/:id`                  | Public        | 200 |
| POST   | `/movies`                      | Admin         | 201 |
| PATCH  | `/movies/:id`                  | Admin         | 200 |
| DELETE | `/movies/:id`                  | Admin         | 204 (soft delete) |
| GET    | `/movies/:id/reviews`          | Public        | 200 |
| POST   | `/movies/:id/reviews`          | Member/Admin  | 201 (409 if already reviewed) |
| PATCH  | `/reviews/:id`                 | Owner/Admin   | **200** (the slide said 201; an update returns 200) |
| DELETE | `/reviews/:id`                 | Owner/Admin   | 204 |
| GET    | `/watchlist/me`                | Member/Admin  | 200 |
| POST   | `/watchlist/me`                | Member/Admin  | 201 — body `{ "movie_id": 1 }` (409 if present) |
| DELETE | `/watchlist/me/:movieId`       | Member/Admin  | 204 |
| GET    | `/admin/tmdb/search?query=`    | Admin         | 200 (503 if not configured) |
| POST   | `/admin/tmdb/import`           | Admin         | 201 — body `{ "tmdb_id": 1 }` (409 if imported) |
| GET    | `/admin/reviews`               | Admin         | 200 — extra endpoint powering the moderation tab |

## Security notes

- Passwords: Argon2id. Sessions: random 256-bit token in an `HttpOnly; SameSite=Lax` cookie (`Secure` in production), 30-day expiry, stored hashed.
- The acting user always comes from the session; `user_id`/`role` in request bodies are ignored.
- CSRF: `SameSite=Lax` plus a server-side `Origin` check on every non-GET request. Behind a proxy that rewrites `Host`, set `APP_ORIGIN`.
- Rate limiting on login (per IP and per email) and registration. **It is in-memory, so it applies per server process**; use a shared store (Redis) or edge limits if you run several instances.
- All input is validated with Zod (pagination capped at 50). Review text is stored raw and rendered as plain text by React, never as HTML.
- Login returns the same error and does equal work for unknown emails and wrong passwords.
- Basic security headers are set in `next.config.ts`. A strict CSP is not configured.

## Project layout

```
prisma/            schema, migrations, seed + seed-data/movies.json
src/app/           pages and /api/v1 route handlers
src/server/        db, auth, services (movies, reviews, watchlist, tmdb), validation
src/components/    UI components
tests/             Vitest API tests + e2e-smoke.mjs browser script
```

## Known limitations

- Rate limiting is per process (see above).
- Poster images load straight from their URL (TMDB's CDN for seeded/imported movies), so they need internet access; a themed placeholder is shown when one fails.
- No password reset, email verification, or user profile page (not in scope).
- Admin review moderation is an extra beyond the slide's endpoint table (`GET /admin/reviews`), because the brief asks for it.
- Dates are shown in the Gregorian calendar (e.g. 2 ต.ค. 2026) so they match the Gregorian release years; switch `th-TH-u-ca-gregory` to `th-TH` in `src/lib/format.ts` for Buddhist-era dates.
