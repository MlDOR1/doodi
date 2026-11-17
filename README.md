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
| `npm test`             | Jest integration tests for five core APIs against `TEST_DATABASE_URL` (wipes that DB) |
| `npm run test:regression` | Original Vitest regression suite against the same dedicated test DB |
| `npm run test:e2e`     | Browser smoke test against a running server (needs Edge/Chrome)  |
| `npm run db:migrate`   | `prisma migrate dev` (create/apply migrations while developing)  |
| `npm run db:deploy`    | `prisma migrate deploy` (apply existing migrations)              |
| `npm run db:seed`      | Idempotent demo data                                             |
| `npm run db:reset`     | **Destroys** the dev database and reapplies migrations            |

`npm run test:e2e` signs up a new throwaway member and creates then soft-deletes a movie in whatever database the server uses, so run it against a dev database only.

### Core API tests with Jest

Run `npm test` to execute `tests/api.jest.ts`. It covers login, the public movie list, and creating, updating and deleting reviews. Assertions check HTTP responses, validation, duplicate reviews, ownership and the rows saved in MySQL.

Jest uses Next.js's existing SWC transformer and Node's VM modules to run the Prisma ESM client. The configuration requires a dedicated `TEST_DATABASE_URL`, applies migrations there, and runs sequentially. The original 31-test suite remains available through `npm run test:regression`. Run the two commands separately because both reset the same test database.

## TMDB import (optional)

The site is fully usable without TMDB. Without a token the admin **นำเข้าจาก TMDB** tab shows a configuration message and the API answers `503 tmdb_not_configured`; nothing is faked.

1. Create a free account at <https://www.themoviedb.org/> and request API access under Settings → API.
2. Copy the **API Read Access Token** (the long `eyJ…` value, not the short API key).
3. Put it in `.env`: `TMDB_API_READ_ACCESS_TOKEN=eyJ...` and restart the server.

The token is read only on the server and never sent to the browser. Imports prefer Thai metadata (`th-TH`) and fall back to English for a missing title or synopsis. Posters use TMDB's `w500` images. The footer and admin page carry TMDB's required attribution; ratings shown on the site are always DOODI community ratings, never TMDB's.

## Data model

### Current movies and professor demo

Run `npm run db:import:current` to fetch up to 20 new movies from TMDB's current Thailand now-playing and popular lists, using the existing Thai/English metadata importer. The command loads `.env.local` and `.env` like Next.js and preserves existing movies, reviews, and soft deletions. Re-run it to refresh the catalog; it never substitutes static seed data when TMDB fails.

Then run `npm run db:seed:demo-reviews` to add three clearly labeled sample reviewers to the 20 most recently imported visible movies. Reviews include different ratings and a spoiler example. Re-running does not overwrite existing reviews. These demo members use random unknown passwords and cannot be accessed with the old seed credentials.

The examples are actual rows in `reviews`, linked to `users.user_id` and `movies.movie_id`; the existing API, moderation page, spoiler handling, review counts, and average ratings read them normally. Demo ratings contribute to the displayed averages. To inspect storage during your presentation:

```sql
SELECT r.reviews_id, u.display_name, m.title, r.rating, r.content,
       r.has_spoiler, r.created_at, r.updated_at
FROM reviews r
JOIN users u ON u.user_id = r.user_id
JOIN movies m ON m.movie_id = r.movie_id
WHERE u.email LIKE '%@reviews.example.test'
ORDER BY r.reviews_id;
```

The movie detail page loads cast/directors, YouTube trailers, recommendations, and Thailand watch providers through four public APIs under `/api/v1/movies/:id`: `/credits`, `/videos`, `/recommendations`, and `/watch-providers`. These use the server-side TMDB token and cache upstream responses for one hour. Empty data and failed requests have separate UI states. Watch availability is credited to JustWatch and links to the TMDB watch page.

Run `npm run db:import:current` manually to add current movies. The app does not schedule imports.

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
| GET    | `/movies/:id/credits`          | Public        | 200 — cast (up to 12) and directors |
| GET    | `/movies/:id/videos`           | Public        | 200 — up to 3 YouTube trailers/teasers, Thai then English |
| GET    | `/movies/:id/recommendations`  | Public        | 200 — up to 8 recommendations with local links when imported |
| GET    | `/movies/:id/watch-providers`  | Public        | 200 — Thailand watch providers with JustWatch attribution |
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
tests/             Jest core API tests, Vitest regression tests, browser smoke script
```

## Known limitations

- Rate limiting is per process (see above).
- Poster images load straight from their URL (TMDB's CDN for seeded/imported movies), so they need internet access; a themed placeholder is shown when one fails.
- No password reset, email verification, or user profile page (not in scope).
- Admin review moderation is an extra beyond the slide's endpoint table (`GET /admin/reviews`), because the brief asks for it.
- Dates are shown in the Gregorian calendar (e.g. 2 ต.ค. 2026) so they match the Gregorian release years; switch `th-TH-u-ca-gregory` to `th-TH` in `src/lib/format.ts` for Buddhist-era dates.
