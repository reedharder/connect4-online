const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const ROWS = 6;
const COLS = 7;

const rooms = {};

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function checkWinner(board, row, col) {
  const player = board[row][col];
  if (!player) return null;

  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
  ];

  for (const [dr, dc] of directions) {
    const winning = [[row, col]];

    for (const sign of [1, -1]) {
      let r = row + dr * sign;
      let c = col + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
        winning.push([r, c]);
        r += dr * sign;
        c += dc * sign;
      }
    }

    if (winning.length >= 4) return { player, cells: winning };
  }

  return null;
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== null);
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const code = generateRoomCode();
    rooms[code] = {
      players: [socket.id],
      board: makeBoard(),
      turn: 'red',
      over: false,
    };
    socket.join(code);
    socket.roomCode = code;
    socket.playerColor = 'red';
    socket.emit('room-created', { code });
  });

  socket.on('join-room', (code) => {
    code = code.toUpperCase().trim();
    const room = rooms[code];

    if (!room) {
      socket.emit('join-error', 'Room not found.');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('join-error', 'Room is full.');
      return;
    }

    room.players.push(socket.id);
    socket.join(code);
    socket.roomCode = code;
    socket.playerColor = 'yellow';

    io.to(code).emit('game-start', {
      board: room.board,
      turn: room.turn,
      yourColor: null,
    });

    // Send individual color assignments
    const [redId, yellowId] = room.players;
    io.to(redId).emit('your-color', 'red');
    io.to(yellowId).emit('your-color', 'yellow');
  });

  socket.on('drop-piece', (col) => {
    const code = socket.roomCode;
    const room = rooms[code];

    if (!room || room.over) return;
    if (room.players.length < 2) return;
    if (room.turn !== socket.playerColor) return;
    if (col < 0 || col >= COLS) return;

    // Find lowest empty row in column
    let landRow = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (room.board[r][col] === null) {
        landRow = r;
        break;
      }
    }
    if (landRow === -1) return; // Column full

    room.board[landRow][col] = room.turn;

    const result = checkWinner(room.board, landRow, col);
    if (result) {
      room.over = true;
      io.to(code).emit('game-update', { board: room.board, turn: room.turn, lastMove: [landRow, col] });
      io.to(code).emit('game-over', { winner: result.player, cells: result.cells });
      return;
    }

    if (isBoardFull(room.board)) {
      room.over = true;
      io.to(code).emit('game-update', { board: room.board, turn: room.turn, lastMove: [landRow, col] });
      io.to(code).emit('game-over', { winner: null, cells: [] });
      return;
    }

    room.turn = room.turn === 'red' ? 'yellow' : 'red';
    io.to(code).emit('game-update', { board: room.board, turn: room.turn, lastMove: [landRow, col] });
  });

  socket.on('rematch', () => {
    const code = socket.roomCode;
    const room = rooms[code];
    if (!room || room.players.length < 2) return;

    room.rematchVotes = (room.rematchVotes || 0) + 1;
    if (room.rematchVotes >= 2) {
      room.board = makeBoard();
      room.turn = 'red';
      room.over = false;
      room.rematchVotes = 0;
      io.to(code).emit('game-start', { board: room.board, turn: room.turn });
      const [redId, yellowId] = room.players;
      io.to(redId).emit('your-color', 'red');
      io.to(yellowId).emit('your-color', 'yellow');
    } else {
      io.to(code).emit('rematch-waiting');
    }
  });

  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code || !rooms[code]) return;
    io.to(code).emit('player-left');
    delete rooms[code];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Connect 4 server running at http://localhost:${PORT}`);
});
