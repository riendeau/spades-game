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

## Client Architecture Details

### Routing

- **No React Router** - Uses manual URL parsing in `App.tsx`
- Pattern: `window.location.pathname.match(/pattern/)`
- Server has SPA fallback (`apps/server/src/index.ts:55`) - all non-API routes serve `index.html`
- **Existing URL routes**:
  - `/room/:id` - Pre-fills room code on join screen (e.g., `/room/ABC123`)
- **To add a new route**: Parse URL in `App.tsx`, pass extracted data as props to components

### Styling

- **Inline styles throughout** - No CSS modules, styled-components, or utility classes
- Custom UI components in `apps/client/src/components/ui/` (Button, Input, Card)
- No CSS preprocessing or CSS-in-JS libraries
- Design system uses hard-coded colors and spacing values
- **Overlapping elements**: Avoid using `opacity` on elements that overlap (e.g., cards with negative margins). Use CSS filters (`grayscale`, `brightness`) and solid background colors instead to prevent transparency stacking artifacts

### Player Badge Design System

All four player positions (three opponents + the local player) use a consistent badge style:

- **Team colors**: team1 = blue (`#3b82f6`), team2 = green (`#22c55e`)
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

## Dependency Management

### Toolchain Versions (as of 2026-02)

- **ESLint 10**: Project uses ESLint 10 with flat config (`eslint.config.js`). Three plugins (`eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`) haven't declared ESLint 10 peer support yet — they're wrapped with `fixupPluginRules()` from `@eslint/compat` to shim removed APIs like `context.getFilename()`.
- **Vite 7 / Vitest 4**: Client uses Vite 7. Use Vitest 4 across all packages. Vite 7 requires Node `^20.19.0 || >=22.12.0` — the project `engines` field reflects this. (Historical note: Vitest 2 used to re-install Vite 5 as a transitive dep; that concern is no longer relevant.)
- **pnpm.overrides**: None currently needed. Express 5.x pulls in `qs@6.15.0` directly; no override required.
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
