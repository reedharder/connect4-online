# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start the server
npm start
# or directly:
node server.js
```

Server runs at `http://localhost:3000` by default. Override with `PORT` env var.

There are no tests or linters configured.

## Architecture

This is a real-time two-player Connect 4 game. The stack is:
- **Backend:** Node.js + Express (static file serving) + Socket.io (WebSocket server)
- **Frontend:** Vanilla HTML/CSS/JS — no build step, no framework

### Request / event flow

```
Browser (game.js) <──Socket.io──> server.js <──Socket.io──> Browser (game.js)
```

All game logic and state live exclusively on the server. The client is a pure display layer that sends player intent and renders whatever the server broadcasts back.

### Server (`server.js`)

Holds all active games in an in-memory `rooms` object keyed by 4-character room code. Each room tracks:
- `players` — array of two socket IDs (index 0 = red, index 1 = yellow)
- `board` — 6×7 2D array, cells are `null | 'red' | 'yellow'`
- `turn` — whose turn it is (`'red'` or `'yellow'`)
- `over` — boolean, blocks further moves
- `rematchVotes` — incremented per player, resets game at 2

**Key server-side validations on `drop-piece`:** wrong turn, game already over, column full, out-of-range column — all silently ignored.

Win detection (`checkWinner`) runs after every placed piece, checking all 4 directions from the landing cell only (not the whole board).

Room cleanup happens on `disconnect` — the entire room is deleted, so reconnection is not supported.

### Socket.io event contract

| Direction | Event | Payload |
|---|---|---|
| client → server | `create-room` | — |
| client → server | `join-room` | `code: string` |
| client → server | `drop-piece` | `col: number` |
| client → server | `rematch` | — |
| server → client | `room-created` | `{ code }` |
| server → client | `join-error` | `message: string` |
| server → client | `your-color` | `'red' \| 'yellow'` |
| server → client | `game-start` | `{ board, turn }` |
| server → client | `game-update` | `{ board, turn, lastMove: [row, col] }` |
| server → client | `game-over` | `{ winner: string \| null, cells: [row,col][] }` |
| server → client | `rematch-waiting` | — |
| server → client | `player-left` | — |

### Client (`public/game.js`)

Manages three UI screens — lobby, waiting room, game — switching between them via a `show()` helper that toggles `hidden` class. Client state (`myColor`, `currentTurn`, `boardState`, `gameOver`) is derived entirely from server events.

Board is re-rendered from scratch on every `game-update` by wiping `boardEl.innerHTML`. Column hover targets (`#column-targets`) are a separate flex row of invisible divs positioned above the board that handle mouse events and emit `drop-piece`.

The client duplicates `ROWS`/`COLS` constants from the server only for the column-hover preview calculation — the server's board state is always the source of truth.
