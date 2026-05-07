const ROWS = 6;
const COLS = 7;

const socket = io();

let myColor = null;
let currentTurn = null;
let boardState = null;
let gameOver = false;

// ── DOM refs ──
const lobby    = document.getElementById('lobby');
const waiting  = document.getElementById('waiting');
const gameDiv  = document.getElementById('game');

const btnCreate    = document.getElementById('btn-create');
const btnJoin      = document.getElementById('btn-join');
const roomInput    = document.getElementById('room-input');
const lobbyError   = document.getElementById('lobby-error');
const roomCodeDisp = document.getElementById('room-code-display');

const statusText       = document.getElementById('status-text');
const boardEl          = document.getElementById('board');
const colTargetsEl     = document.getElementById('column-targets');
const gameOverBanner   = document.getElementById('game-over-banner');
const gameOverText     = document.getElementById('game-over-text');
const btnRematch       = document.getElementById('btn-rematch');
const rematchWaiting   = document.getElementById('rematch-waiting');
const roomLabel        = document.getElementById('room-label');

// ── Lobby events ──
btnCreate.addEventListener('click', () => {
  lobbyError.textContent = '';
  socket.emit('create-room');
});

btnJoin.addEventListener('click', joinRoom);
roomInput.addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });

function joinRoom() {
  const code = roomInput.value.trim().toUpperCase();
  if (code.length !== 4) { lobbyError.textContent = 'Enter a 4-character room code.'; return; }
  lobbyError.textContent = '';
  socket.emit('join-room', code);
}

// ── Socket events ──
socket.on('room-created', ({ code }) => {
  roomCodeDisp.textContent = code;
  show(waiting);
});

socket.on('join-error', msg => {
  lobbyError.textContent = msg;
});

socket.on('your-color', color => {
  myColor = color;
});

socket.on('game-start', ({ board, turn }) => {
  boardState = board;
  currentTurn = turn;
  gameOver = false;
  gameOverBanner.classList.add('hidden');
  rematchWaiting.classList.add('hidden');
  renderBoard();
  renderColTargets();
  updateStatus();
  show(gameDiv);
});

socket.on('game-update', ({ board, turn, lastMove }) => {
  boardState = board;
  currentTurn = turn;
  renderBoard(lastMove);
  updateStatus();
});

socket.on('game-over', ({ winner, cells }) => {
  gameOver = true;
  renderBoard(null, cells);
  if (winner) {
    gameOverText.textContent = winner === myColor
      ? 'You win!'
      : `${capitalize(winner)} wins!`;
  } else {
    gameOverText.textContent = "It's a draw!";
  }
  gameOverBanner.classList.remove('hidden');
  updateStatus();
});

socket.on('rematch-waiting', () => {
  rematchWaiting.classList.remove('hidden');
  btnRematch.disabled = true;
});

socket.on('player-left', () => {
  gameOverText.textContent = 'Opponent disconnected.';
  gameOverBanner.classList.remove('hidden');
  btnRematch.classList.add('hidden');
  gameOver = true;
});

// ── Board rendering ──
function renderBoard(lastMove = null, winningCells = []) {
  boardEl.innerHTML = '';
  const winSet = new Set((winningCells || []).map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const val = boardState[r][c];
      if (val) {
        cell.classList.add(val);
        if (lastMove && lastMove[0] === r && lastMove[1] === c) {
          cell.classList.add('drop');
        }
      }
      if (winSet.has(`${r},${c}`)) cell.classList.add('winning');
      boardEl.appendChild(cell);
    }
  }
}

function renderColTargets() {
  colTargetsEl.innerHTML = '';
  for (let c = 0; c < COLS; c++) {
    const target = document.createElement('div');
    target.className = 'col-target';
    const arrow = document.createElement('div');
    arrow.className = 'arrow';
    target.appendChild(arrow);

    target.addEventListener('mouseenter', () => {
      if (!isMyTurn()) return;
      target.classList.add('hovered');
      highlightColumn(c, true);
    });
    target.addEventListener('mouseleave', () => {
      target.classList.remove('hovered');
      highlightColumn(c, false);
    });
    target.addEventListener('click', () => {
      if (!isMyTurn() || gameOver) return;
      socket.emit('drop-piece', c);
    });

    colTargetsEl.appendChild(target);
  }
}

function highlightColumn(col, on) {
  const cells = boardEl.querySelectorAll('.cell');
  // Find lowest empty row in this column for preview
  let previewRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!boardState[r][col]) { previewRow = r; break; }
  }

  cells.forEach((cell, idx) => {
    const c = idx % COLS;
    const r = Math.floor(idx / COLS);
    if (c !== col) return;
    cell.classList.remove('preview-red', 'preview-yellow');
    if (on && r === previewRow && myColor) {
      cell.classList.add(`preview-${myColor}`);
    }
  });
}

// ── Status ──
function updateStatus() {
  if (gameOver) {
    statusText.innerHTML = '';
    return;
  }
  const isYours = isMyTurn();
  const color = currentTurn;
  statusText.innerHTML = `<span class="dot" style="background:${color === 'red' ? '#e84040' : '#f0c040'}"></span>${isYours ? 'Your turn' : "Opponent's turn"}`;
}

function isMyTurn() {
  return myColor && currentTurn === myColor && !gameOver;
}

// ── Rematch ──
btnRematch.addEventListener('click', () => {
  socket.emit('rematch');
  rematchWaiting.classList.remove('hidden');
  btnRematch.disabled = true;
});

// ── Helpers ──
function show(el) {
  [lobby, waiting, gameDiv].forEach(d => d.classList.add('hidden'));
  el.classList.remove('hidden');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
