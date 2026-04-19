const ROWS = 8;
const COLS = 6;

const COLOR_LIST = [
  { key: 'lime', label: '黄緑 / Lime', hex: '#9fe870', priority: 1 },
  { key: 'blue', label: '青 / Blue', hex: '#58a6ff', priority: 2 },
  { key: 'purple', label: '紫 / Purple', hex: '#a77bff', priority: 3 },
  { key: 'sparklePurple', label: 'キラ紫 / Sparkle Purple', hex: '#d39bff', priority: 4 },
  { key: 'orange', label: 'オレンジ / Orange', hex: '#ffad5a', priority: 5 },
  { key: 'sparkleOrange', label: 'キラ橙 / Sparkle Orange', hex: '#ffd27a', priority: 6 },
  { key: 'red', label: '赤 / Red', hex: '#ff6666', priority: 7 }
];
const colorMap = Object.fromEntries(COLOR_LIST.map(c => [c.key, c]));

const ORIENTATIONS = {
  O: [{ name: '0°', coords: [[0, 0], [0, 1], [1, 0], [1, 1]] }],
  I: [
    { name: '横 / Horizontal', coords: [[0, 0], [0, 1], [0, 2], [0, 3]] },
    { name: '縦 / Vertical', coords: [[0, 0], [1, 0], [2, 0], [3, 0]] }
  ],
  T: [
    { name: 'Up', coords: [[0, 0], [0, 1], [0, 2], [1, 1]] },
    { name: 'Right', coords: [[0, 1], [1, 0], [1, 1], [2, 1]] },
    { name: 'Down', coords: [[0, 1], [1, 0], [1, 1], [1, 2]] },
    { name: 'Left', coords: [[0, 0], [1, 0], [1, 1], [2, 0]] }
  ],
  L: [
    { name: 'Up', coords: [[0, 0], [1, 0], [2, 0], [2, 1]] },
    { name: 'Right', coords: [[0, 0], [0, 1], [0, 2], [1, 0]] },
    { name: 'Down', coords: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    { name: 'Left', coords: [[0, 2], [1, 0], [1, 1], [1, 2]] }
  ],
  J: [
    { name: 'Up', coords: [[0, 1], [1, 1], [2, 0], [2, 1]] },
    { name: 'Right', coords: [[0, 0], [1, 0], [1, 1], [1, 2]] },
    { name: 'Down', coords: [[0, 0], [0, 1], [1, 0], [2, 0]] },
    { name: 'Left', coords: [[0, 0], [0, 1], [0, 2], [1, 2]] }
  ]
};

const state = {
  mode: 'auto',
  paintMode: 'paint',
  paintColor: 'red',
  board: Array.from({ length: ROWS }, () => Array(COLS).fill(null)),
  locked: Array.from({ length: ROWS }, () => Array(COLS).fill(false)),
  pieces: [],
  hint: null,
  dragPieceId: null
};

const el = {
  board: document.getElementById('board'),
  paintColor: document.getElementById('paintColor'),
  paintToggle: document.getElementById('paintToggle'),
  eraseToggle: document.getElementById('eraseToggle'),
  resetBoard: document.getElementById('resetBoard'),
  resetAll: document.getElementById('resetAll'),
  piecesList: document.getElementById('piecesList'),
  addPiece: document.getElementById('addPiece'),
  solveBtn: document.getElementById('solveBtn'),
  hintBtn: document.getElementById('hintBtn'),
  applyHintBtn: document.getElementById('applyHintBtn'),
  status: document.getElementById('status'),
  modeAuto: document.getElementById('modeAuto'),
  modeManual: document.getElementById('modeManual'),
  lineSummary: document.getElementById('lineSummary'),
  pieceRowTemplate: document.getElementById('pieceRowTemplate')
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function init() {
  COLOR_LIST.forEach(c => {
    const option = document.createElement('option');
    option.value = c.key;
    option.textContent = c.label;
    el.paintColor.append(option);
  });

  el.paintColor.value = state.paintColor;
  el.paintColor.addEventListener('change', () => (state.paintColor = el.paintColor.value));

  el.paintToggle.addEventListener('click', () => setPaintMode('paint'));
  el.eraseToggle.addEventListener('click', () => setPaintMode('erase'));
  el.resetBoard.addEventListener('click', resetBoardOnly);
  el.resetAll.addEventListener('click', resetAll);
  el.addPiece.addEventListener('click', () => addPiece());
  el.solveBtn.addEventListener('click', runAutoSolve);
  el.hintBtn.addEventListener('click', runHint);
  el.applyHintBtn.addEventListener('click', applyHint);
  el.modeAuto.addEventListener('click', () => setMode('auto'));
  el.modeManual.addEventListener('click', () => setMode('manual'));
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'r' || !state.dragPieceId) return;
    const piece = state.pieces.find(p => p.id === state.dragPieceId);
    if (!piece) return;
    rotatePiece(piece);
    renderPieces();
    renderBoardFromPlaced();
    setStatus('Rotated selected piece / 選択ピースを回転');
  });

  renderBoard();
  for (let i = 0; i < 8; i++) addPiece();
  renderPieces();
}

function setMode(mode) {
  state.mode = mode;
  el.modeAuto.classList.toggle('active', mode === 'auto');
  el.modeManual.classList.toggle('active', mode === 'manual');
  setStatus(mode === 'auto' ? 'Auto mode / 自動モード' : 'Manual mode / 手動モード');
}

function setPaintMode(mode) {
  state.paintMode = mode;
  el.paintToggle.classList.toggle('active', mode === 'paint');
  el.eraseToggle.classList.toggle('active', mode === 'erase');
}

function addPiece(data = null) {
  const piece = data || { id: uid(), shape: 'T', orientation: 0, color: 'red', placed: null };
  state.pieces.push(piece);
  renderPieces();
}

function removePiece(id) {
  const idx = state.pieces.findIndex(p => p.id === id);
  if (idx >= 0) state.pieces.splice(idx, 1);
  renderPieces();
  renderBoard();
}

function getPieceCoords(piece) {
  return ORIENTATIONS[piece.shape][piece.orientation].coords;
}

function paintCell(r, c) {
  if (state.paintMode === 'erase') {
    state.board[r][c] = null;
    state.locked[r][c] = false;
  } else {
    state.board[r][c] = state.paintColor;
    state.locked[r][c] = true;
  }
  renderBoard();
}

function renderBoard(lines = [], hintCells = []) {
  el.board.innerHTML = '';
  const lineSet = new Set(lines);
  const hintSet = new Set(hintCells.map(([r, c]) => `${r},${c}`));

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      if (state.board[r][c]) {
        div.style.background = colorMap[state.board[r][c]].hex;
      }
      if (state.locked[r][c]) div.classList.add('prefilled');
      if (lineSet.has(r)) div.classList.add('line');
      if (hintSet.has(`${r},${c}`)) div.classList.add('hint');

      div.addEventListener('click', () => {
        if (state.mode === 'manual' && state.dragPieceId) {
          placeDraggedPiece(r, c);
          return;
        }
        paintCell(r, c);
      });

      div.addEventListener('dragover', (e) => e.preventDefault());
      div.addEventListener('drop', (e) => {
        e.preventDefault();
        if (state.mode !== 'manual') return;
        const id = e.dataTransfer.getData('text/plain');
        state.dragPieceId = id;
        placeDraggedPiece(r, c);
      });

      el.board.append(div);
    }
  }

  const scored = evaluateBoard(state.board);
  el.lineSummary.textContent = `Lines: ${scored.lineCount} / ${ROWS} | Color score: ${scored.colorScore}`;
}

function renderPieces() {
  el.piecesList.innerHTML = '';
  state.pieces.forEach(piece => {
    const row = el.pieceRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.id = piece.id;

    const shapeSel = row.querySelector('.shape');
    ['O', 'I', 'T', 'L', 'J'].forEach(shape => {
      const opt = document.createElement('option');
      opt.value = shape;
      opt.textContent = shape;
      shapeSel.append(opt);
    });
    shapeSel.value = piece.shape;

    const orientSel = row.querySelector('.orientation');
    const colorSel = row.querySelector('.color');
    COLOR_LIST.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.key;
      opt.textContent = c.label;
      colorSel.append(opt);
    });
    colorSel.value = piece.color;

    const syncOrientation = () => {
      orientSel.innerHTML = '';
      ORIENTATIONS[piece.shape].forEach((o, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = o.name;
        orientSel.append(opt);
      });
      if (piece.orientation >= ORIENTATIONS[piece.shape].length) piece.orientation = 0;
      orientSel.value = piece.orientation;
    };

    syncOrientation();

    shapeSel.addEventListener('change', () => {
      piece.shape = shapeSel.value;
      piece.orientation = 0;
      piece.placed = null;
      syncOrientation();
      updateMiniPreview(row, piece);
      renderBoard();
    });
    orientSel.addEventListener('change', () => {
      piece.orientation = Number(orientSel.value);
      piece.placed = null;
      updateMiniPreview(row, piece);
      renderBoard();
    });
    colorSel.addEventListener('change', () => {
      piece.color = colorSel.value;
      renderBoardFromPlaced();
    });

    row.querySelector('.remove').addEventListener('click', () => removePiece(piece.id));
    row.querySelector('.rotate').addEventListener('click', (e) => {
      e.stopPropagation();
      rotatePiece(piece);
      renderPieces();
      renderBoardFromPlaced();
    });
    row.draggable = true;
    row.addEventListener('dragstart', (e) => {
      if (state.mode !== 'manual') return;
      e.dataTransfer.setData('text/plain', piece.id);
      state.dragPieceId = piece.id;
    });
    row.addEventListener('click', () => {
      if (state.mode === 'manual') {
        state.dragPieceId = piece.id;
        setStatus('Click board to place (R=rotate) / クリックで配置（Rで回転）');
      }
    });

    updateMiniPreview(row, piece);
    el.piecesList.append(row);
  });
}

function updateMiniPreview(row, piece) {
  const pv = row.querySelector('.mini-preview');
  pv.innerHTML = '';
  const coords = getPieceCoords(piece);
  const minR = Math.min(...coords.map(c => c[0]));
  const minC = Math.min(...coords.map(c => c[1]));
  coords.forEach(([r, c]) => {
    const b = document.createElement('div');
    b.className = 'mini-block';
    b.style.left = `${(c - minC) * 12 + 5}px`;
    b.style.top = `${(r - minR) * 12 + 5}px`;
    b.style.background = colorMap[piece.color].hex;
    pv.append(b);
  });
}


function rotatePiece(piece) {
  const max = ORIENTATIONS[piece.shape].length;
  piece.orientation = (piece.orientation + 1) % max;
  if (piece.placed) {
    const { r, c } = piece.placed;
    clearDynamicBoardCells();
    for (const p of state.pieces) {
      if (p.id === piece.id || !p.placed) continue;
      for (const [dr, dc] of getPieceCoords(p)) {
        state.board[p.placed.r + dr][p.placed.c + dc] = p.color;
      }
    }
    if (!canPlace(piece, r, c, false, null, state.board)) {
      piece.placed = null;
      setStatus('Rotation invalid at current spot; piece removed / 回転後に重なるため未配置化');
    }
  }
}

function clearDynamicBoardCells() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!state.locked[r][c]) state.board[r][c] = null;
    }
  }
}

function renderBoardFromPlaced() {
  clearDynamicBoardCells();
  for (const piece of state.pieces) {
    if (!piece.placed) continue;
    for (const [dr, dc] of getPieceCoords(piece)) {
      const rr = piece.placed.r + dr;
      const cc = piece.placed.c + dc;
      if (inside(rr, cc)) state.board[rr][cc] = piece.color;
    }
  }
  const score = evaluateBoard(state.board);
  renderBoard(score.lines);
}

function placeDraggedPiece(r, c) {
  const piece = state.pieces.find(p => p.id === state.dragPieceId);
  if (!piece) return;

  const valid = canPlace(piece, r, c, true, piece.id);
  if (!valid) {
    setStatus('Invalid placement / 配置不可');
    return;
  }
  piece.placed = { r, c };
  renderBoardFromPlaced();
  setStatus('Placed / 配置完了');
}

function canPlace(piece, baseR, baseC, ignoreCurrentPiece = false, pieceId = null, board = state.board) {
  for (const [dr, dc] of getPieceCoords(piece)) {
    const r = baseR + dr;
    const c = baseC + dc;
    if (!inside(r, c)) return false;
    if (state.locked[r][c]) return false;
    const occupiedByOther = board[r][c] !== null;
    if (!occupiedByOther) continue;

    if (ignoreCurrentPiece && pieceId) {
      let own = false;
      const p = state.pieces.find(x => x.id === pieceId);
      if (p && p.placed) {
        own = getPieceCoords(p).some(([rr, cc]) => p.placed.r + rr === r && p.placed.c + cc === c);
      }
      if (own) continue;
    }
    return false;
  }
  return true;
}

function inside(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function evaluateBoard(board) {
  const lines = [];
  let colorScore = 0;
  for (let r = 0; r < ROWS; r++) {
    const full = board[r].every(Boolean);
    if (!full) continue;
    lines.push(r);
    for (let c = 0; c < COLS; c++) {
      colorScore += colorMap[board[r][c]].priority;
    }
  }
  return { lineCount: lines.length, lines, colorScore };
}

function resetBoardOnly() {
  state.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  state.locked = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  state.pieces.forEach(p => (p.placed = null));
  state.hint = null;
  renderBoard();
  setStatus('Board reset / 盤面リセット');
}

function resetAll() {
  resetBoardOnly();
  state.pieces = [];
  for (let i = 0; i < 8; i++) addPiece();
  renderPieces();
  setStatus('All reset / 全リセット');
}

function setStatus(msg) {
  el.status.textContent = msg;
}

function buildLockedBoard() {
  const b = Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (state.locked[r][c] ? state.board[r][c] : null)));
  return b;
}

function possiblePlacements(piece, board) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let ok = true;
      for (const [dr, dc] of getPieceCoords(piece)) {
        const rr = r + dr;
        const cc = c + dc;
        if (!inside(rr, cc) || board[rr][cc] !== null) {
          ok = false;
          break;
        }
      }
      if (ok) out.push({ r, c });
    }
  }
  return out;
}

function placeOnBoard(board, piece, pos) {
  const copy = board.map(row => row.slice());
  for (const [dr, dc] of getPieceCoords(piece)) {
    copy[pos.r + dr][pos.c + dc] = piece.color;
  }
  return copy;
}

function cmpScore(a, b) {
  if (a.lineCount !== b.lineCount) return b.lineCount - a.lineCount;
  if (a.colorScore !== b.colorScore) return b.colorScore - a.colorScore;
  return 0;
}

function solveBest(piecesInput, boardInput, maxNodes = 120000) {
  let nodes = 0;
  let best = { score: evaluateBoard(boardInput), board: boardInput, placements: [] };

  const pieces = piecesInput.slice();
  pieces.sort((a, b) => getPieceCoords(b).length - getPieceCoords(a).length);

  function dfs(idx, board, placements) {
    nodes += 1;
    if (nodes > maxNodes) return;
    const score = evaluateBoard(board);
    if (cmpScore(score, best.score) < 0) {
      best = { score, board, placements: placements.slice() };
      if (score.lineCount === ROWS) return;
    }

    if (idx >= pieces.length) return;

    const remaining = pieces.length - idx;
    const maxLinesPossible = Math.min(ROWS, score.lineCount + remaining);
    if (maxLinesPossible < best.score.lineCount) return;

    const piece = pieces[idx];
    const spots = possiblePlacements(piece, board);

    dfs(idx + 1, board, placements);

    for (const pos of spots) {
      const nextBoard = placeOnBoard(board, piece, pos);
      placements.push({ pieceId: piece.id, r: pos.r, c: pos.c });
      dfs(idx + 1, nextBoard, placements);
      placements.pop();
      if (nodes > maxNodes) return;
    }
  }

  dfs(0, boardInput, []);
  return { ...best, nodesExplored: nodes, truncated: nodes > maxNodes };
}

function runAutoSolve() {
  state.pieces.forEach(p => (p.placed = null));
  const lockedBoard = buildLockedBoard();
  const result = solveBest(state.pieces, lockedBoard);
  clearDynamicBoardCells();

  result.placements.forEach(pl => {
    const piece = state.pieces.find(p => p.id === pl.pieceId);
    if (!piece) return;
    piece.placed = { r: pl.r, c: pl.c };
  });
  renderBoardFromPlaced();
  setStatus(`Solved lines=${result.score.lineCount}, color=${result.score.colorScore}${result.truncated ? ' (limit)' : ''}`);
}

function runHint() {
  const lockedBoard = buildLockedBoard();
  const fixedPlaced = state.pieces.filter(p => p.placed);
  const remaining = state.pieces.filter(p => !p.placed);

  let currentBoard = lockedBoard;
  for (const piece of fixedPlaced) {
    if (!canPlace(piece, piece.placed.r, piece.placed.c, false, null, currentBoard)) {
      setStatus('Current manual placement has overlap / 重なりあり');
      return;
    }
    currentBoard = placeOnBoard(currentBoard, piece, piece.placed);
  }

  const result = solveBest(remaining, currentBoard, 80000);
  const first = result.placements[0];
  if (!first) {
    state.hint = null;
    renderBoard(evaluateBoard(state.board).lines, []);
    setStatus('No hint available / ヒントなし');
    return;
  }

  const piece = state.pieces.find(p => p.id === first.pieceId);
  const cells = getPieceCoords(piece).map(([dr, dc]) => [first.r + dr, first.c + dc]);
  state.hint = { pieceId: first.pieceId, r: first.r, c: first.c, cells };
  const score = evaluateBoard(state.board);
  renderBoard(score.lines, cells);
  setStatus(`Hint: place ${piece.shape} @ (${first.r},${first.c})`);
}

function applyHint() {
  if (!state.hint) {
    setStatus('No hint / ヒントなし');
    return;
  }
  const piece = state.pieces.find(p => p.id === state.hint.pieceId);
  if (!piece) return;
  piece.placed = { r: state.hint.r, c: state.hint.c };
  state.hint = null;
  renderBoardFromPlaced();
  setStatus('Hint applied / ヒント適用');
}

init();
