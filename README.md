# Serpent Arena

A multiplayer snake arena game. Grow, boost, and dominate.

## Quick Start

```bash
npm install
npm run dev
```

This starts both the game server (port 3001) and Vite dev server (port 5173).
Open http://localhost:5173 to play.

## Architecture

- **Server-authoritative**: The server owns all game state. Clients send inputs only.
- **Offline mode**: Play locally with bots when the server isn't available.
- **Socket.IO**: Real-time communication with interpolation for smooth rendering.

### Collision Rules
- **Head-to-body**: Snake dies
- **Head-to-head**: Both snakes die
- **Boundary**: Snake dies on contact
- **Self-collision**: Disabled by default

### Balance
All tunable values are in `shared/src/constants.ts`.

## Project Structure

```
/shared/src/       - Types, constants, math utilities
/server/src/       - Game engine, entities, systems, bots, networking
/client/src/       - Renderer, input, UI, audio, camera, game state
/tests/            - Basic validation tests
```

## Commands

- `npm run dev` - Start both server and client in dev mode
- `npm run dev:server` - Start just the server
- `npm run dev:client` - Start just the Vite client
- `npm test` - Run tests
