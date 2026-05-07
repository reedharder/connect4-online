const ROWS = 6;
const COLS = 7;

let board = makeBoard();
let currentTurn = 'red';
let gameOver = false;

const boardEl        = document.getElementById('board');
const colTargetsEl   = document.getElementById('column-targets');
const statusText     = document.getElementById('status-text');
const gameOverBanner = document.getElementById('game-over-banner');
const gameOverText   = document.getElementById('game-over-text');
const btnPlayAgain   = document.getElementById('btn-play-again');

function makeBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function checkWinner(row, col) {
  const player = board[row][col];
  const directions = [[0,1],[1,0],[1,1],[1,-1]];
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
    if (winning.length >= 4) return winning;
  }
  return null;
}

function isBoardFull() {
  return board[0].every(cell => cell !== null);
}

function dropPiece(col) {
  if (gameOver) return;
  let landRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) { landRow = r; break; }
  }
  if (landRow === -1) return;

  board[landRow][col] = currentTurn;

  const winning = checkWinner(landRow, col);
  if (winning) {
    gameOver = true;
    renderBoard([landRow, col], winning);
    gameOverText.textContent = `${capitalize(currentTurn)} wins!`;
    gameOverBanner.classList.remove('hidden');
    statusText.innerHTML = '';
    return;
  }

  if (isBoardFull()) {
    gameOver = true;
    renderBoard([landRow, col]);
    gameOverText.textContent = "It's a draw!";
    gameOverBanner.classList.remove('hidden');
    statusText.innerHTML = '';
    return;
  }

  currentTurn = currentTurn === 'red' ? 'yellow' : 'red';
  renderBoard([landRow, col]);
  updateStatus();
}

function renderBoard(lastMove = null, winningCells = []) {
  boardEl.innerHTML = '';
  const winSet = new Set((winningCells || []).map(([r, c]) => `${r},${c}`));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const val = board[r][c];
      if (val) {
        cell.classList.add(val);
        if (lastMove && lastMove[0] === r && lastMove[1] === c) cell.classList.add('drop');
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
      if (gameOver) return;
      target.classList.add('hovered');
      highlightColumn(c, true);
    });
    target.addEventListener('mouseleave', () => {
      target.classList.remove('hovered');
      highlightColumn(c, false);
    });
    target.addEventListener('click', () => dropPiece(c));

    colTargetsEl.appendChild(target);
  }
}

function highlightColumn(col, on) {
  let previewRow = -1;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) { previewRow = r; break; }
  }
  boardEl.querySelectorAll('.cell').forEach((cell, idx) => {
    const c = idx % COLS;
    const r = Math.floor(idx / COLS);
    if (c !== col) return;
    cell.classList.remove('preview-red', 'preview-yellow');
    if (on && r === previewRow) cell.classList.add(`preview-${currentTurn}`);
  });
}

function updateStatus() {
  const color = currentTurn === 'red' ? '#e84040' : '#f0c040';
  statusText.innerHTML = `<span class="dot" style="background:${color}"></span>${capitalize(currentTurn)}'s turn`;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

btnPlayAgain.addEventListener('click', () => {
  board = makeBoard();
  currentTurn = 'red';
  gameOver = false;
  gameOverBanner.classList.add('hidden');
  renderBoard();
  renderColTargets();
  updateStatus();
});

// Init
renderBoard();
renderColTargets();
updateStatus();
