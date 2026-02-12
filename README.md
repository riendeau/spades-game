# Spades

A real-time multiplayer Spades card game built with TypeScript, React, and Socket.io.

## Prerequisites

- Node.js >= 18
- [pnpm](https://pnpm.io/)

## Getting Started

```bash
pnpm install        # Install dependencies
pnpm build          # Build all packages (required before first run)
pnpm dev            # Start the server and client in parallel
```

The server runs on **http://localhost:3001** and the client on **http://localhost:5173**.

To run just one side:

```bash
pnpm --filter @spades/server dev    # Server only
pnpm --filter @spades/client dev    # Client only
```

## Running Tests

### Unit tests

Unit tests use [Vitest](https://vitest.dev/) and live in `packages/shared/src/__tests__/`.

```bash
pnpm test           # Run unit tests across all packages
```

Run a single test file:

```bash
pnpm --filter @spades/shared test src/__tests__/deck.test.ts
```

### E2E tests

End-to-end tests use [Playwright](https://playwright.dev/) and live in `e2e/tests/`. They automatically start the dev server and client if they aren't already running.

```bash
pnpm test:e2e                   # Run E2E tests (headless)
pnpm --filter @spades/e2e test:headed   # Run with a visible browser
pnpm --filter @spades/e2e test:debug    # Run in Playwright debug mode
```

### All tests

```bash
pnpm test:all       # Unit tests, then E2E tests
```

## Project Structure

```
packages/
  shared/    Core game logic, types, validation, and state machine (@spades/shared)
  mods/      Rule mods (e.g. Suicide Spades) and theme mods (@spades/mods)
apps/
  server/    Express + Socket.io server (@spades/server)
  client/    React + Vite + Zustand client (@spades/client)
e2e/         Playwright end-to-end tests (@spades/e2e)
```

## How It Works

Players create or join a room using a 6-character code. Once four players are in and ready, the game begins.

The game follows a server-authoritative model: all logic runs on the server, and clients send intents (`game:bid`, `game:play-card`) that the server validates before broadcasting state updates. Player hands are never revealed to other players.

### Game phases

`waiting` &rarr; `ready` &rarr; `dealing` &rarr; `bidding` &rarr; `playing` &harr; `trick-end` &rarr; `round-end` &rarr; `game-end`

### Mod system

Rule mods hook into game events (`onValidateBid`, `onCalculateScore`, etc.) to modify behavior. Theme mods supply CSS variable overrides.

## Other Commands

```bash
pnpm build          # Build all packages
pnpm lint           # Lint all packages
```
