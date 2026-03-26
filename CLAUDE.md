# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (required before first run)
pnpm dev              # Start server (port 3001) and client (port 5173) in parallel
pnpm test             # Run all tests

# Package-specific commands
pnpm --filter @spades/shared build    # Build shared package only
pnpm --filter @spades/server dev      # Run server only
pnpm --filter @spades/client dev      # Run client only

# Run specific test file
pnpm --filter @spades/shared test src/__tests__/deck.test.ts
```

## Architecture

This is a real-time multiplayer Spades card game using a pnpm monorepo with TypeScript throughout.

### Packages

- **packages/shared** (`@spades/shared`): Core game logic, types, validation, and state machine. Shared between server and client.
- **packages/mods** (`@spades/mods`): Rule mods and theme mods. Extensible via hook system. Currently active: anti-eleven mod. Reference examples (inactive): suicide-spades, joker-spades.
- **apps/server** (`@spades/server`): Express + Socket.io server. Manages rooms, sessions, and authoritative game state.
- **apps/client** (`@spades/client`): React + Vite + Zustand client with Socket.io connection.

### Key Design Patterns

**Server-Authoritative State**: All game logic runs on the server. Clients send intents (bid, play card), server validates and broadcasts state updates. Player hands are never sent to other players.

**Hand Tracking** (`apps/server/src/game/game-instance.ts`): The state machine is the single source of truth for player hands via `GameState.players[].hand`. `getPlayerHand()` reads directly from the state. `toClientState()` only exposes `cardCount` (not the cards themselves) to prevent cheating. Private hands are sent to individual clients via the `game:cards-dealt` socket event.

**State Machine** (`packages/shared/src/state-machine/game-machine.ts`): Game phases flow: `waiting` → `ready` → `dealing` → `bidding` → `playing` ↔ `trick-end` → `round-end` → `game-end`. All state transitions go through `processAction()`.

**Session Management**: 6-character room codes for joining. Session tokens stored in `sessionStorage` (per-tab) enable reconnection during games with 5-minute grace period.

**Mod System**: Rule mods implement hooks (`onCalculateScore`, `onCalculateDisabledBids`, etc.) that intercept game events. Theme mods provide CSS variable definitions.

**Important Hook Semantics:**

- **`modifyConfig`**: Called **once** during room creation (`room-manager.ts:createRoom()`) to allow mods to declaratively modify game configuration (e.g., disable nil bids, change bag penalties). The modified config is passed to the `GameInstance` constructor and affects basic validation and game logic throughout the game.
- **`onCalculateDisabledBids`**: Called **once** per state update during bidding to pre-calculate which bids should be disabled for the current player. This hook should make any random decisions **once** and store them in `modState` for consistency. Subsequent calls should read from `modState` instead of re-randomizing.
- **Rule**: If you need randomness or state in bid restrictions, use `onCalculateDisabledBids` and store decisions in `modState`. Never call `Math.random()` in hooks that run multiple times per state update.

### Socket Events

Client → Server: `room:create`, `room:join`, `room:ready`, `game:bid`, `game:play-card`, `player:reconnect`

Server → Client: `room:joined`, `game:state-update`, `game:cards-dealt`, `game:trick-won`, `game:round-end`

### Important Files

- `packages/shared/src/types/` - All TypeScript types (Card, Player, GameState, Events, Mod)
- `packages/shared/src/game-logic/` - Deck, trick resolution, scoring, bidding rules
- `apps/server/src/socket/handler.ts` - All socket event handlers
- `apps/server/src/rooms/room-manager.ts` - Room and session management (includes modifyConfig hook invocation)
- `apps/server/src/mods/mod-loader.ts` - Registers built-in mods (controls which mods are active)
- `apps/server/src/mods/hook-executor.ts` - Executes mod hooks in sequence
- `apps/server/src/db/game-results.ts` - Game result persistence and player stats queries
- `apps/client/src/hooks/use-game.ts` - Main client-side game hook

### Team Structure

- **Positions**: 0, 1, 2, 3 (clockwise from dealer's left)
- **Teams**: Positions 0 & 2 are `team1`, positions 1 & 3 are `team2`
- **Partners**: Use `getPartnerPosition(position)` helper which returns `(position + 2) % 4`
- **Bidding order**: Position 0 → 1 → 2 → 3 (partners alternate)

## Development Environment

### Dev Server Setup

The server uses **nodemon** (not `tsx watch`) for file watching in development. This choice is critical for proper process management:

**Why nodemon:**

- Properly forwards SIGINT/SIGTERM signals to child processes
- Waits for graceful shutdown before restarting on file changes
- Prevents orphaned Node.js processes when stopping with Ctrl+C
- More reliable when running under `pnpm --parallel`

**Graceful Shutdown:**
The server implements SIGINT/SIGTERM handlers (`apps/server/src/index.ts`) that:

- Immediately disconnect all Socket.io clients
- Close the HTTP server
- Exit within 100ms to prevent force-kill from process managers

**If you encounter EADDRINUSE errors:**

```bash
# Find and kill orphaned process on port 3001
lsof -ti :3001 | xargs kill
```

This typically happens if:

- The dev server was force-killed (kill -9) instead of Ctrl+C
- System crash or unexpected termination
- The graceful shutdown handler failed to complete

### Mobile Preview

Append `?mobile` to any URL to render the app inside a phone-shaped iframe on desktop:

```
http://localhost:5173/?mobile              # Lobby in compact mode
http://localhost:5173/room/ABC123?mobile   # Pre-fills room code
```

- **How it works**: `main.tsx` checks for `?mobile` and renders `MobilePreview` instead of `SocketProvider` + `App`. The component displays a phone frame (390×844) with an `<iframe>` that loads the same URL minus `?mobile`.
- **Why iframe**: `GameTable` uses `height: 100vh`, which resolves to the iframe's height. `useIsMobile()` naturally returns `true` inside the 390px-wide iframe — no hook changes needed.
- **Orientation toggle**: A toolbar button switches between portrait (390×844) and landscape (844×390). Landscape exercises the `height < 500` breakpoint. The iframe is not remounted, so game state is preserved.
- **No socket leak**: The parent page never renders `SocketProvider`, so no extra connection is created.

## Client Architecture Details

### Routing

- **No React Router** - Uses manual URL parsing in `App.tsx`
- Pattern: `window.location.pathname.match(/pattern/)`
- Server has SPA fallback (`apps/server/src/index.ts:55`) - all non-API routes serve `index.html`
- **Existing URL routes**:
  - `/room/:id` - Pre-fills room code on join screen (e.g., `/room/ABC123`)
  - `/stats` - Player stats page (win/loss record, partner history)
- **To add a new route**: Parse URL in `App.tsx`, pass extracted data as props to components

### Styling

- **Inline styles throughout** - No CSS modules, styled-components, or utility classes
- Custom UI components in `apps/client/src/components/ui/` (Button, Input, Card)
- No CSS preprocessing or CSS-in-JS libraries
- Design system uses hard-coded colors and spacing values
- **Overlapping elements**: Avoid using `opacity` on elements that overlap (e.g., cards with negative margins). Use CSS filters (`grayscale`, `brightness`) and solid background colors instead to prevent transparency stacking artifacts

### Player Badge Design System

All four player positions (three opponents + the local player) use a consistent badge style:

- **Team colors**: team1 = maroon (`#861F41`), team2 = orange (`#E5751F`)
- **Active player**: full-saturation border + background tint + `box-shadow` glow in team color
- **Inactive players**: faded border (`rgba(..., 0.35)`) + very subtle background tint (`rgba(..., 0.07)`)
- **Player names**: near-white (`#f9fafb`) for legibility on the dark green table; gray (`#9ca3af`) when disconnected
- **Bid/Won line**: always shown under every player name — displays `—` for bid until a bid is placed
- **Local player badge**: rendered between the trick area and hand section (south table position), styled identically to `OpponentArea` badges. Padding should match `OpponentArea`'s `12px` desktop / `6px` mobile to keep visual consistency.

### Mobile Responsiveness

- **`useIsMobile` hook** (`apps/client/src/hooks/use-is-mobile.ts`): Returns `true` when `width < 768` **OR** `height < 500`. The height check is critical — landscape-orientation phones have wide viewports (>768px) but short ones (~375px), so a width-only check misses them entirely.
- **All game components** accept a `compact` prop (passed as `compact={isMobile}` from `GameTable`) — desktop layout is completely unchanged when `isMobile` is false.
- **`GameTable`** uses `height: 100vh` + `overflow: hidden`, so it fills the viewport exactly regardless of orientation.
- **`WaitingRoom`** uses a 2×2 seat grid on mobile and the compass layout (North/W+E/South) on desktop. The header (Room Code + Share Link) is a single compact row on both.

### State Management

- **Zustand store** in `apps/client/src/store/game-store.ts`
- Session persistence uses `sessionStorage` (per-tab, survives page refresh)
- Server is authoritative - client state is derived from socket events
- No optimistic updates - all state changes are server-confirmed

## E2E Testing

### Test Structure

- **Fixtures** in `e2e/fixtures/game-fixtures.ts` provide reusable test setups:
  - `createPlayerPage(nickname)`: Creates isolated browser context + page, navigates to home
  - `fourPlayerRoom`: Pre-creates 4-player room in waiting state
  - `fourPlayerBidding`: Pre-creates 4-player room in bidding phase (all players ready)
- All fixtures handle cleanup automatically (close contexts after test)

### Test Helpers

- **Location**: `e2e/helpers/` (e.g., `room-helpers.ts`, `game-helpers.ts`)
- **Pattern**: Export functions that take `Page` and perform common actions
- **Selector specificity**: Be specific with selectors to avoid "strict mode violations"
  - Use `data-testid` attributes when multiple similar elements exist
  - Use `.first()`, `.last()`, or filter by text/attributes
  - Example: `page.locator('code[title="Click to copy"]').first()` for room code

### Running Tests

```bash
pnpm --filter @spades/e2e test                    # All tests
pnpm --filter @spades/e2e test filename.spec.ts   # Single file
```

### Test Environment

- Tests run against **dev servers** (client: port 5173, server: port 3001)
- Not against built/production assets
- `baseURL` in `playwright.config.ts` is `http://localhost:5173`
- Both servers auto-start via `webServer` config

### Common Patterns & Gotchas

- **Clipboard tests**: Use `page.context().grantPermissions(['clipboard-read', 'clipboard-write'])`
- **Multiple elements**: Playwright throws "strict mode violation" if locator matches multiple elements
- **Card interactions**: Use `[data-testid="hand-card"]` to target hand cards (not trick area cards)
- **Native vs React events**: Always use Playwright's `.click()`, not `page.evaluate(() => btn.click())`
- **Bid button clicks**: When clicking bid number buttons, use the `placeBid()` helper from `bidding-helpers.ts` instead of manual `getByRole('button', { name: '5' }).click()`. This prevents "strict mode violations" when hand cards with the same number are visible (e.g., 5 of diamonds). The helper uses more specific selectors and handles the "See Cards" step automatically.
- **Port conflicts when running E2E locally**: E2E tests start their own dev servers on ports 3001 and 5173. If a preview server or `pnpm dev` is already running on those ports, all tests will fail. Always run `lsof -ti :3001 :5173 | xargs kill` before running E2E tests locally.
- **UI text changes break E2E assertions**: Tests in `shareable-url.spec.ts` and others assert on visible text labels. When renaming UI strings, grep for the old text in `e2e/` and update assertions to match.

## Authentication

### Architecture

**Session strategy:** `express-session` with a PostgreSQL store (`connect-pg-simple`) in production. The same session middleware is shared with Socket.io by calling it directly in `io.use()`. In dev (no `DATABASE_URL`), the default in-memory store is used — no Postgres required locally.

**Dev bypass:** When `NODE_ENV !== 'production'`, a middleware after passport auto-injects `DEV_USER` into every request, and the Socket.io auth check is skipped entirely. `GET /auth/me` returns `DEV_USER` so `LoginGate` immediately renders the app. `pnpm dev` requires no Google credentials or local database.

**What is/isn't protected:**

- **Protected (server-side):** `/api/*` routes, Socket.io connections (production only)
- **Public:** `/health`, `/auth/*`, all static files (needed to load the React app before LoginGate renders)

### Key Files

- `apps/server/src/auth/passport-config.ts` — Google OAuth strategy + `Express.User` global augmentation
- `apps/server/src/auth/auth-routes.ts` — Express router for `/auth/google`, `/auth/google/callback`, `/auth/logout`, `/auth/me`
- `apps/server/src/db/client.ts` — `pg.Pool` from `DATABASE_URL`
- `apps/server/src/db/schema.ts` — `createTables()` (idempotent; only runs when `DATABASE_URL` is set)
- `apps/server/src/db/game-results.ts` — `insertGameResult()` + `getPlayerStats()` for the `game_results` table
- `apps/client/src/components/auth/LoginGate.tsx` — Fetches `/auth/me` on mount; shows Google sign-in UI to unauthenticated users; exposes user via `UserContext`

### Gotchas

**`Express.User` augmentation:** `passport-config.ts` uses `declare global { namespace Express { interface User { ... } } }` to type `req.user` across the whole server. This pattern requires TypeScript namespace syntax, which the `@typescript-eslint/no-namespace` rule flags. The workaround is a `// eslint-disable-next-line` placed on the `namespace Express {` line _inside_ the `declare global {}` block — not on the `declare global {` line itself.

**Async passport callbacks:** `passport-google-oauth20` verify callbacks and `passport.deserializeUser` must **not** be declared `async` — the rule `@typescript-eslint/no-misused-promises` will fire. Use the `void (async () => { ... })().catch(done)` IIFE pattern for the verify callback, and a promise chain (`.then().catch()`) for `deserializeUser`.

**Session middleware + Socket.io:** All three middleware handlers — `sessionMiddleware`, `passport.initialize()`, and `passport.session()` — must run in the `io.use()` chain, not just `sessionMiddleware`. `passport.session()` is what reads `session.passport.user` and calls `deserializeUser()` to populate `socket.request.user`. Without it, the user is never deserialized, every Socket.io connection is rejected as `Unauthorized`, and the client gets stuck on "Connecting...". Store the passport handlers before `app.use()` so they can be reused in `io.use()`. Socket.io's `next` is narrower than Express's `NextFunction` — cast it: `next as unknown as express.NextFunction`.

**Cookie scoping in dev:** The Vite dev server proxies both `/socket.io` and `/auth` to port 3001. This keeps cookies scoped to `localhost:5173` so the OAuth callback cookie and the Socket.io connection cookie are the same origin. No `changeOrigin` needed — keeping the `Host: localhost:5173` header is intentional.

**Render.yaml DB wiring:** The `DATABASE_URL` env var is populated from `fromDatabase.property: connectionString` (Render's built-in linking). All OAuth secrets (`GOOGLE_CLIENT_ID`, etc.) are `sync: false` — set them manually in the Render dashboard to avoid committing secrets.

**Callback URL / trust proxy:** The passport strategy uses `callbackURL: '/auth/google/callback'` (a relative path). Passport constructs the full URL from the request's `Host` and `X-Forwarded-Proto` headers, so the same code works for any deployment — main app, preview apps, etc. — without a `GOOGLE_CALLBACK_URL` env var. `app.set('trust proxy', 1)` is required so Render's load balancer's `X-Forwarded-Proto: https` header is trusted and passport builds `https://` URLs. Each deployment's callback URL must still be registered as an authorized redirect URI in Google Console.

### Required Env Vars (production only)

| Variable               | Purpose                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | Google OAuth app client ID                                         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app secret                                            |
| `SESSION_SECRET`       | Signs the session cookie (32+ random chars)                        |
| `ALLOWED_EMAILS`       | Comma-separated allowlist (e.g. `alice@gmail.com,bob@gmail.com`)   |
| `DATABASE_URL`         | PostgreSQL connection string (auto-set by Render from DB resource) |

## Game Result Tracking

Completed games are recorded in the `game_results` table. Player identity is bridged from Google OAuth into game sessions via a `userId` field on `PlayerSession`.

**How it works:**

- `PlayerSession.userId` is populated from `socket.request.user.id` when a session is created (in `handleCreateRoom`, `handleJoinRoom`, `handleSelectSeat`).
- On the `GAME_COMPLETE` side effect, `handler.ts` calls `recordGameResult()` which maps player positions to user IDs and inserts a row (fire-and-forget).
- Player columns use `UUID REFERENCES users(id) ON DELETE SET NULL` — nullable so games survive user deletion.
- Position → column mapping: pos 0 → `team1_player1`, pos 2 → `team1_player2`, pos 1 → `team2_player1`, pos 3 → `team2_player2`.

**Stats API:** `GET /api/stats` returns `{ totalGames, wins, losses, winRate, partners[] }` for the authenticated user. In dev (no `DATABASE_URL`), returns zeros.

**Client:** `/stats` route renders `StatsPage` with summary cards and partner history. Linked from the lobby via "Your Stats".

## Dependency Management

### Toolchain Versions (as of 2026-03)

- **ESLint 10**: Project uses ESLint 10 with flat config (`eslint.config.js`). Three plugins (`eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`) haven't declared ESLint 10 peer support yet — they're wrapped with `fixupPluginRules()` from `@eslint/compat` to shim removed APIs like `context.getFilename()`. `eslint-plugin-react-refresh` explicitly declares ESLint 10 support as of v0.5.1 and is used directly without `fixupPluginRules()`.
- **Vite 8 / Vitest 4**: Client uses Vite 8 (upgraded from Vite 7). Vite 8 uses Rolldown instead of Rollup as its production bundler. Use Vitest 4 across all packages. `@vitejs/plugin-react` v6 dropped built-in Babel support (Vite 8 handles React Refresh via Oxc natively) — this project doesn't use Babel options so no impact. Vite 8 requires Node `>=20.19.0 || >=22.12.0`.
- **pnpm.overrides**: `minimatch@3` → `3.1.4` and `minimatch@10` → `10.2.3` to resolve Dependabot ReDoS alerts. Both are within the semver ranges their consumers (`eslint-plugin-import`, `eslint-plugin-react`, `eslint`, `nodemon`) already declare, so no compatibility risk. These can be removed once the upstream packages ship with patched minimatch versions. `socket.io-parser@>=4.0.0 <4.2.6` → `4.2.6` to fix CVE-2026-33151 (unbounded binary attachments DoS). Within the `~4.2.4` range declared by `socket.io@4.8.3` — can be removed once a newer `socket.io` release resolves 4.2.6 in its lockfile. `flatted@<=3.4.1` → `3.4.2` to fix CVE-2026-33228 (prototype pollution via `parse()`). Within the `^3.2.9` range declared by `flat-cache@4.0.1` — can be removed once `flat-cache` ships with 3.4.2 in its lockfile. `picomatch@>=4.0.0 <4.0.4` → `4.0.4` to fix ReDoS and method injection vulnerabilities. Within the `^4.0.1` range declared by `tinyglobby` and `lint-staged` — can be removed once those packages resolve 4.0.4 in their lockfiles.
- **pnpm.onlyBuiltDependencies**: `esbuild` is listed here so its postinstall script (which downloads the native binary) runs when the version changes.

### Upgrading ESLint plugins to ESLint 10

When a plugin causes `context.getFilename is not a function` or similar errors on ESLint 10, wrap it:

```js
import { fixupPluginRules } from '@eslint/compat';
// In eslint.config.js:
plugins: { 'plugin-name': fixupPluginRules(thePlugin) }
```

## Workflow

After every bug fix or feature implementation:

1. Create a new branch with a descriptive name for the work (e.g., `fix/bidding-validation`, `feat/dark-mode`).
2. Commit the changes using the [Conventional Commits](https://www.conventionalcommits.org/) standard. Format: `<type>(<optional scope>): <description>`. Common types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`, `ci`, `build`. Use `!` after the type/scope for breaking changes (e.g., `feat!: ...`). Include a body for additional context when needed.
3. **Run all tests locally** to ensure they pass before pushing:
   ```bash
   pnpm test                    # Run all tests (unit + E2E)
   pnpm --filter @spades/e2e test  # Run E2E tests only if needed
   ```
4. Push the branch and open a PR to merge into `main` using `gh pr create`. Do **not** push directly to `main`.
5. **Update Documentation**: After successful implementation (all tests pass, PR ready), reflect on what you had to discover or learn during implementation. Update this `CLAUDE.md` file with any patterns, gotchas, or architectural details that would have saved time. This keeps the documentation current and helps future work go faster. Add a `docs(claude): <description>` commit to the same branch before merging.
