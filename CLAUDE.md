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
- **packages/mods** (`@spades/mods`): Rule mods (e.g., Suicide Spades) and theme mods. Extensible via hook system.
- **apps/server** (`@spades/server`): Express + Socket.io server. Manages rooms, sessions, and authoritative game state.
- **apps/client** (`@spades/client`): React + Vite + Zustand client with Socket.io connection.

### Key Design Patterns

**Server-Authoritative State**: All game logic runs on the server. Clients send intents (bid, play card), server validates and broadcasts state updates. Player hands are never sent to other players.

**State Machine** (`packages/shared/src/state-machine/game-machine.ts`): Game phases flow: `waiting` → `ready` → `dealing` → `bidding` → `playing` ↔ `trick-end` → `round-end` → `game-end`. All state transitions go through `processAction()`.

**Session Management**: 6-character room codes for joining. Session tokens stored in `sessionStorage` (per-tab) enable reconnection during games with 5-minute grace period.

**Mod System**: Rule mods implement hooks (`onValidateBid`, `onCalculateScore`, etc.) that intercept game events. Theme mods provide CSS variable definitions.

### Socket Events

Client → Server: `room:create`, `room:join`, `room:ready`, `game:bid`, `game:play-card`, `player:reconnect`

Server → Client: `room:joined`, `game:state-update`, `game:cards-dealt`, `game:trick-won`, `game:round-end`

### Important Files

- `packages/shared/src/types/` - All TypeScript types (Card, Player, GameState, Events, Mod)
- `packages/shared/src/game-logic/` - Deck, trick resolution, scoring, bidding rules
- `apps/server/src/socket/handler.ts` - All socket event handlers
- `apps/server/src/rooms/room-manager.ts` - Room and session management
- `apps/client/src/hooks/use-game.ts` - Main client-side game hook

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
