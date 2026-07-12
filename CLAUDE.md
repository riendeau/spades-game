# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (required before first run)
pnpm dev              # Start server (port 3001) and client (port 5173) in parallel
pnpm test             # Run all tests
pnpm knip             # Report unused files, exports, and dependencies (monorepo-wide)

# Package-specific commands
pnpm --filter @spades/shared build    # Build shared package only
pnpm --filter @spades/server dev      # Run server only
pnpm --filter @spades/client dev      # Run client only

# Run specific test file
pnpm --filter @spades/shared test src/__tests__/deck.test.ts
```

### Dead-Code Detection (knip)

`pnpm knip` finds unused files, exports, and dependencies across the whole module graph. This catches a class of dead code that **neither ESLint nor `tsc` can**: `@typescript-eslint/no-unused-vars` is file-scoped (an `export`ed symbol or a public class method is "used" by definition, since something _could_ import it), and TypeScript's `noUnusedLocals`/`noUnusedParameters` are likewise file-local and never flag exports. Knip walks importers across packages, so a never-imported export is reported.

- **Config**: `knip.json` at the root, intentionally just `{ "$schema": ... }`. Workspaces, entry points (app `main.tsx`/`index.ts`, test files, `playwright.config.ts`), and plugins (vite, vitest, playwright, eslint) are all **auto-detected** — keep the config minimal; knip emits "Remove redundant entry pattern" hints if you over-specify.
- **`ignoreExportsUsedInFile` is deliberately left off.** Knip therefore flags any `export` that no _other_ module imports, even one used within its own file — the correct fix is to drop the `export` keyword (the symbol stays, now module-private). This is the right policy for a single-consumer repo: there's no external API to preserve, so "exported" should mean "actually imported elsewhere." TypeScript permits this even for a type referenced by an exported signature (e.g. `PartnerStats` inside the exported `PlayerStats`): without `isolatedDeclarations`, `tsc` inlines the private type into the emitted `.d.ts`, so the build stays clean.
- **Caveat unrelated to the above:** an export imported _only_ by its own unit test is a cross-file import, so knip counts it as used and will **not** flag it. That blind spot is inherent to knip treating test files as consumers — it must still be caught by review, regardless of config.
- The baseline is green; a non-zero `pnpm knip` in CI means genuinely unreachable code (or a newly-redundant `export`) was added.

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

**Reconnection Flow** (`apps/client/src/hooks/use-game.ts`, `apps/client/src/socket/socket-context.tsx`): The client emits `player:reconnect` (with sessionToken + roomId) from a handler bound directly to Socket.io's `'connect'` event — **not** from a `useEffect` gated on the SocketContext's `connected` boolean. React state can batch fast disconnect/reconnect transitions, so a brief blip can produce a `'connect'`-then-`'connect'` sequence where `connected` never observably flips to false — a `useEffect([connected])` would skip the emit, leaving the new server-side socket with no session attached. Subsequent actions then fail with `SESSION_NOT_FOUND`, and the only recovery is for a teammate to click "Replace." Always bind reconnection-critical logic to the underlying socket events, not to React-mirrored state. When debugging reconnection issues, the server log line `[reconnect] attempt …` (in `handleReconnect`) is the ground truth — its absence following a `[session] marking disconnected` means the client never tried to reconnect. The server's `'disconnect'` handler logs the Socket.io `reason` (`"ping timeout"`, `"transport close"`, `"transport error"`, `"client namespace disconnect"`, etc.), which distinguishes server-side ping timeouts from client-initiated closes.

**Client→Server Debug Relay** (`apps/client/src/socket/debug.ts`, `handleClientDebug` in `handler.ts`): Browser-side reconnect breadcrumbs (`connect`/`disconnect`/`reconnect-attempt`/`reconnect-success`/`reconnect-error`/`reconnect-failed` from socket-context, `reconnect-emit`/`reconnect-skip` from use-game) are relayed to the server via the `client:debug` event and logged as `[client <token8>…] <event> room=… reason=… socket=…` — so a phone's reconnect failures are visible in the Render logs, correlated by `sessionToken` with the existing `[reconnect]`/`[session]` lines. The server handler is deliberately **inert**: log-only, no state mutation, shape-coerces every field (never throws on a malformed payload), and rate-caps at 20 events/sec per socket via a `WeakMap` token bucket. Default on; set `DEBUG_CLIENT_RELAY='false'` to silence in production. Breadcrumbs that occur while the socket is _disconnected_ (e.g. `disconnect`, `reconnect-failed`) can't be emitted live, so `emitDebug` buffers them in `sessionStorage` (`spades_debug_buffer`, bounded to 50) and `flushDebugBuffer` drains them on the next `connect` — this is what captures the terminal "client silently vanished" cases. `emitDebug` always mirrors to `console.log` too, so local dev keeps identical breadcrumbs.

**Card Reveal Semantics** (`apps/client/src/store/game-store.ts:setHand`): The client's `setHand` action resets `cardsRevealed: false` as a side effect — that's correct for normal round dealing (player should click "See Cards" or "Bid Blind Nil" each round), but it means any logic that wants to reveal cards after a `game:cards-dealt` must do so in the same handler, _not_ via `setTimeout` or a separate handler. Inter-event ordering on the wire isn't reliable (especially on Socket.io polling transport, where successive emits can land in separate JS tasks), so anything that schedules a reveal "after the next setHand" via timers will race. For mid-game seat replacement, the server sets `autoReveal: true` on the `game:cards-dealt` payload whenever the seat has no See Cards / Bid Blind Nil decision left to make — i.e. past bidding entirely, or still bidding but the seat has already passed the decision point this round. That "passed the decision point" state is tracked server-side as `Player.hasViewedCards`, set by either a `PLAYER_VIEW_CARDS` action (fired from the client's `game:see-cards` socket event whenever the local `revealCards` runs) or a `MAKE_BID` action (any bid commits past the decision). It resets per round in `handleStartNextRound` and is not exposed in `ClientGameState`. The client honors `autoReveal` inline with `setHand` so both state changes commit atomically. Server logs the capture (`[seat] see-cards recorded …`) and the resulting decision (`[seat] cards-dealt … hasViewedCards=… autoReveal=…`) so the input and output of the autoReveal decision can be correlated when debugging.

**Idle Player Kick** (`apps/server/src/rooms/idle-timer.ts`): A 2-minute idle timer runs server-side during each player's turn (bidding/playing phases). The server tracks `turnStartedAt` per room and exposes it in `ClientGameState`. Clients compute countdowns locally. After 2 minutes, other players can kick the idle player via `player:kick-idle` → the server validates, notifies the kicked player with `player:kicked-for-idle`, disconnects their socket, and opens the seat for replacement (reuses the existing Replace flow). The `syncIdleTimer(room)` helper in `handler.ts` must be called after every action that changes the turn or phase.

**Mod System**: Rule mods implement hooks (`onCalculateScore`, `onCalculateDisabledBids`, etc.) that intercept game events. Theme mods provide CSS variable definitions.

**Important Hook Semantics:**

- **`modifyConfig`**: Called **once** during room creation (`room-manager.ts:createRoom()`) to allow mods to declaratively modify game configuration (e.g., disable nil bids, change bag penalties). The modified config is passed to the `GameInstance` constructor and affects basic validation and game logic throughout the game.
- **`onCalculateDisabledBids`**: Called **once** per state update during bidding to pre-calculate which bids should be disabled for the current player. This hook should make any random decisions **once** and store them in `modState` for consistency. Subsequent calls should read from `modState` instead of re-randomizing.
- **Rule**: If you need randomness or state in bid restrictions, use `onCalculateDisabledBids` and store decisions in `modState`. Never call `Math.random()` in hooks that run multiple times per state update.
- **Disabled bids are enforced server-side in `GameInstance.makeBid()`**, not just greyed out in the client's `BiddingPanel`. Both the enforcement check and `toClientState()` go through `GameInstance.getDisabledBids()`, which runs the hook chain and caches the decision in `modState` — so the buttons the client disables and the bids the server rejects come from the same computation. Don't add a second hook-invocation path.

**Socket Input Hardening** (`apps/server/src/socket/handler.ts`): Socket.io does **not** catch exceptions thrown in event handlers — an uncaught throw propagates out of the emitter and kills the whole Node process. A bare `socket.emit('game:bid')` (no payload) used to crash the server via parameter destructuring. Every client-originated event must therefore be registered through the `safeOn()` wrapper (catches, logs, answers the sender with `INVALID_INPUT`), never with a raw `socket.on()`. Relatedly, the TypeScript types on `ClientToServerEvents` payloads are wire-level fiction: values must be runtime-validated before use. Existing guards to reuse: `isValidPosition()` (shared, `player.ts`) for seat positions (an out-of-range seat would deadlock the 0–3 turn rotation), `Number.isInteger` in `validateBid` for bids (NaN passes plain range comparisons and poisons scores into unfinishable games), `isValidCard()` for cards, `=== true` coercion for booleans. The regression suite `apps/server/src/__tests__/socket-handler-hardening.test.ts` fires malformed payloads at every client event — extend it when adding a new event.

### Socket Events

Client → Server: `room:create`, `room:join`, `room:ready`, `game:bid`, `game:play-card`, `player:reconnect`, `player:kick-idle`, `client:debug`

Server → Client: `room:joined`, `game:state-update`, `game:cards-dealt`, `game:trick-won`, `game:round-end`, `player:kicked-for-idle`

### Important Files

- `packages/shared/src/types/` - All TypeScript types (Card, Player, GameState, Events, Mod)
- `packages/shared/src/game-logic/` - Deck, trick resolution, scoring, bidding rules
- `apps/server/src/socket/handler.ts` - All socket event handlers
- `apps/server/src/rooms/room-manager.ts` - Room and session management (includes modifyConfig hook invocation)
- `apps/server/src/rooms/idle-timer.ts` - Idle player kick timer (2-minute inactivity threshold)
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
- **Team accent colors** (`apps/client/src/styles/colors.ts`): `TEAM_ACCENT_COLORS` / `TEAM_ACCENT_RGB` are brighter, same-hue variants used only for the active-turn highlight (border + glow + background tint). Derived from the base team colors by `brightenForAccent()`, which does an HSL nudge of `+17 saturation, +10 lightness` (clamped at 100). The base maroon is too dark to pop as a box-shadow glow against the dark green table; the accent produces a vibrant rose instead. Orange accent barely differs from the base (it was already bright). To retune, edit the `ACCENT_SAT_BOOST` / `ACCENT_LIGHTNESS_BOOST` constants — per-team overrides aren't supported on purpose.
- **Active player**: accent-colored border + `rgba(accent, 0.22)` background tint + layered `box-shadow` (2px inner accent ring at 0.35 alpha + 20px/4px outer glow at 0.85 alpha)
- **Inactive players**: faded border (`rgba(base, 0.35)`) + very subtle background tint (`rgba(base, 0.07)`)
- **Player names**: near-white (`#f9fafb`) for legibility on the dark green table; gray (`#9ca3af`) when disconnected
- **Bid/Won line**: always shown under every player name — displays `—` for bid until a bid is placed
- **Local player badge**: rendered between the trick area and hand section (south table position), styled identically to `OpponentArea` badges. Padding should match `OpponentArea`'s `12px` desktop / `6px` mobile to keep visual consistency.

### Mobile Responsiveness

- **`useIsMobile` hook** (`apps/client/src/hooks/use-is-mobile.ts`): Returns `true` when `width < 768` **OR** `height < 500`. The height check is critical — landscape-orientation phones have wide viewports (>768px) but short ones (~375px), so a width-only check misses them entirely.
- **All game components** accept a `compact` prop (passed as `compact={isMobile}` from `GameTable`) — desktop layout is completely unchanged when `isMobile` is false.
- **`GameTable`** uses `height: 100vh` + `overflow: hidden`, so it fills the viewport exactly regardless of orientation.
- **`WaitingRoom`** uses a 2×2 seat grid on mobile and the compass layout (North/W+E/South) on desktop. The header (Room Code + Share Link) is a single compact row on both.

### Champions Graphic (end-of-game)

`ChampionsGraphic` (`apps/client/src/components/game/ChampionsGraphic.tsx`) renders the end-game "Spades Champions" image shown inline in `GameEndModal`. It draws a fixed template photo (`apps/client/src/assets/champions.webp`, 929×895 — a paper-plate photo cropped tight to the plate's bounding box and saved as lossy WebP-with-alpha, ~72KB vs ~1.3MB as PNG) onto a `<canvas>` at native resolution (scaled down with `maxWidth: 100%`), then overlays four dynamic text fields — date, winner name, loser name, score (`winner > loser`) — at coordinates calibrated to the template's handwritten slots (the `FIELDS` constant). Cropping the asset means `FIELDS` coordinates are in the cropped pixel space; if the asset is ever re-cropped, shift every coordinate by the crop offset.

- **Canvas + custom font gotcha**: a `@font-face`/bundled font is **not** usable by `ctx.fillText` until it has actually loaded — canvas silently falls back to a default font with no error. The component loads the marker font (`assets/fonts/permanent-marker.woff2`) via the `FontFace` API and `await`s both `font.load()` and `img.decode()` **before** the first draw. Any redraw on prop change must re-await, not assume the font is ready.
- **Re-tuning coordinates**: append `?champions-debug` to the URL to overlay a 100px coordinate grid on the canvas, then nudge the `FIELDS` x/y values. `fitFontSize` auto-shrinks long team names to their field's `maxWidth`.
- **Previewing in dev**: the modal lives behind `LoginGate` inside `App`, so a standalone preview route only renders if the **auth server is also running** — use `pnpm dev` (both client + server), not `pnpm --filter @spades/client dev` alone, or `/auth/me` 404s and `App` never mounts. Screenshots were captured with the Playwright install in `e2e/` (import `chromium` from `@playwright/test`; run the script from inside `e2e/` so its `node_modules` resolves).

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

### Toolchain Versions (as of 2026-04)

- **TypeScript 6**: Upgraded from TypeScript 5.9. TS 6 removes legacy module systems (`amd`, `umd`, `systemjs`, `none`), removes `--moduleResolution classic`, and changes several defaults (`strict` → `true`, `module` → `esnext`, `types` → `[]`). This project is unaffected because all tsconfigs already set these explicitly. `esModuleInterop: true` in `tsconfig.base.json` is now always-on and technically redundant, but harmless to keep. `typescript-eslint@8.58.2` supports `typescript <6.1.0`. Use `"ignoreDeprecations": "6.0"` in tsconfig if you need to temporarily suppress deprecation warnings for removed options (they become hard errors in TS 7).
- **ESLint 10**: Project uses ESLint 10 with flat config (`eslint.config.js`). Two plugins (`eslint-plugin-react`, `eslint-plugin-import`) haven't declared ESLint 10 peer support yet — they're wrapped with `fixupPluginRules()` from `@eslint/compat` to shim removed APIs like `context.getFilename()`. `eslint-plugin-react-hooks` added ESLint 10 peer support in 7.1.0 and `eslint-plugin-react-refresh` in v0.5.1, so both are used directly without `fixupPluginRules()`.
- **Vite 8 / Vitest 4**: Client uses Vite 8 (upgraded from Vite 7). Vite 8 uses Rolldown instead of Rollup as its production bundler. Use Vitest 4 across all packages. `@vitejs/plugin-react` v6 dropped built-in Babel support (Vite 8 handles React Refresh via Oxc natively) — this project doesn't use Babel options so no impact. Vite 8 requires Node `>=20.19.0 || >=22.12.0`.
- **pnpm.overrides**: One active override — `"ws@>=8.0.0 <8.21.0": "8.21.0"` (re-added 2026-06-15 for GHSA / Dependabot #31, a memory-exhaustion DoS in `ws < 8.21.0`). This one **cannot** be resolved by an in-range bump: `engine.io@6.6.8` (the latest, pulled transitively via `socket.io@4.8.3`) pins `ws: ~8.20.1`, which excludes the `8.21.0` fix, and there is no newer `engine.io`. The override forces `8.21.0` (a compatible minor — `ws` engines `node>=10`, no breaking API change) across the tree. **Remove condition:** once `engine.io`/`socket.io` publish a release whose declared `ws` range includes `8.21.0`+, drop the override and confirm via the redundancy method below. The other three alerts in that batch (`esbuild` → 0.28.1, `@babel/core` → 7.29.7, `brace-expansion` → 5.0.6) needed **no** override — their fixed versions were already inside the consumers' declared ranges (`tsx` pins `esbuild: ~0.28.0`, react-hooks pins `@babel/core: ^7.24.4`, `minimatch` pins `brace-expansion: ^5.0.2`), so `pnpm update -r --depth Infinity <pkg>` pulled them. A prior batch of nine security overrides (`minimatch@3`/`minimatch@10`, `socket.io-parser`, `flatted`, `picomatch`, `yaml`, two `brace-expansion` majors, and `path-to-regexp`) was removed on 2026-06-10 once upstream caught up: every consumer's declared semver range now resolves to a CVE-fixed version on its own, so the overrides had become no-ops. Note that "upstream caught up" can mean two different things — most deps published a patch _within_ their existing range (e.g. `socket.io-parser@4.2.6` under `socket.io`'s `~4.2.4`), but `picomatch` was only freed because its _consumers_ (`tinyglobby`, `lint-staged`) raised their declared floor to `^4.0.4` (there is still no `picomatch > 4.0.4`). The `yaml` override was the subtle one: it forced `yaml@2.8.3` to satisfy Vite's _optional peer_ (`^2.4.2`), so its redundancy could only be confirmed empirically — removing it let Vite's peer resolve to `2.9.0` and deduped the lockfile's two `yaml` copies into one.
  - **How to verify an override is now redundant** (the method used here, fully non-mutating thanks to git): for each override, find the consumer's declared range with `npm view <consumer>@<version> dependencies.<dep>`, then check `npm view <dep> version` (or the published versions list) — the override is redundant if the highest in-range publish is ≥ the CVE-fixed version. Then confirm empirically: delete the `overrides` block, run `pnpm install --lockfile-only`, and grep the regenerated `pnpm-lock.yaml` to confirm every formerly-pinned package stayed at/above its fixed version (watch for _optional peer deps_ like `yaml`, which static analysis can't fully predict). Run `pnpm build && pnpm test && pnpm lint && pnpm knip`, then `git checkout package.json pnpm-lock.yaml` if anything regressed. Re-resolving the lockfile may also bump unrelated in-range deps (e.g. `lint-staged`, `typescript-eslint` minor versions) — that's expected and harmless.
  - **When a new Dependabot/CVE alert fires**, re-add a targeted override here (e.g. `"<pkg>@<vulnerable-range>": "<fixed-version>"`), keeping the fixed version inside the range the consumer already declares so there's no compatibility risk, and add a one-line note above describing the CVE and the removal condition.
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
