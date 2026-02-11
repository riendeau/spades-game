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
