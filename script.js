// === 盤の種類 ===
const BOARDS = {
  segway:     { key: 'segway',     name: 'セグウェイ', alias: 'Scooter', rows: 8, cols: 7,  color: '#58a6ff' },
  skateboard: { key: 'skateboard', name: 'スケボー',   alias: 'Hover',   rows: 8, cols: 9,  color: '#a77bff' },
  horse:      { key: 'horse',      name: '馬',         alias: 'Doom',    rows: 8, cols: 12, color: '#ff6666' }
};
const BOARD_ORDER = ['horse', 'skateboard', 'segway'];

// === 品質 (grade) ===
// 紫 (excellent) は旧キラ紫の色を、金 (epic) は旧キラ橙の色を流用。
// 紫+1, 金+1 は同色にスパークル表現を重ねて上位種を表現。
const GRADES = [
  { key: 'good',          label: '緑 (good)',        hex: '#9fe870', priority: 1, sparkle: false },
  { key: 'better',        label: '青 (better)',      hex: '#58a6ff', priority: 2, sparkle: false },
  { key: 'excellent',     label: '紫 (excellent)',   hex: '#d39bff', priority: 3, sparkle: false },
  { key: 'excellentPlus', label: '紫+1 (excellent+1)', hex: '#d39bff', priority: 4, sparkle: true  },
  { key: 'epic',          label: '金 (epic)',        hex: '#ffd27a', priority: 5, sparkle: false },
  { key: 'epicPlus',      label: '金+1 (epic+1)',    hex: '#ffd27a', priority: 6, sparkle: true  },
  { key: 'legend',        label: '赤 (legend)',      hex: '#ff6666', priority: 7, sparkle: false }
];
const gradeMap = Object.fromEntries(GRADES.map(g => [g.key, g]));
const GRADES_DESC_PRIORITY = GRADES.slice().sort((a, b) => b.priority - a.priority);

// === 効果メモ ===
const EFFECTS = [
  { key: 'Cr', labelJa: 'クリティカルダメージ', labelEn: 'Critical damage' },
  { key: 'Sk', labelJa: 'スキルダメージ', labelEn: 'Skill damage' },
  { key: 'Sh', labelJa: 'シールドダメージ', labelEn: 'Shield damage' },
  { key: 'P',  labelJa: '毒', labelEn: 'Poisoned' },
  { key: 'W',  labelJa: '衰弱', labelEn: 'Weakened' },
  { key: 'Ch', labelJa: '氷結', labelEn: 'Chilled' },
  { key: 'L',  labelJa: '裂傷', labelEn: 'Lacerated' },
  { key: 'B',  labelJa: 'ボスダメージ', labelEn: 'Boss damage' }
];
const EFFECT_KEYS = new Set(EFFECTS.map(e => e.key));

// === 形状 ===
const SHAPES = ['O', 'I', 'T', 'L', 'J'];
const SHAPE_ORIENTATIONS = {
  O: [[[0,0],[0,1],[1,0],[1,1]]],
  I: [
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]]
  ],
  T: [
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,1],[1,0],[1,1],[2,1]],
    [[0,1],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[1,1],[2,0]]
  ],
  L: [
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[1,1],[2,1]],
    [[0,2],[1,0],[1,1],[1,2]]
  ],
  J: [
    [[0,1],[1,1],[2,0],[2,1]],
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,2]]
  ]
};

// === 状態 ===
// 精密モード盤優先順位: メイン > 馬 > スケボー > セグウェイ
const PRECISE_BOARD_RANK = { horse: 0, skateboard: 1, segway: 2 };

const state = {
  boardsUsed: { segway: true, skateboard: false, horse: false },
  mainBoard: 'segway',
  paintMode: 'paint',            // 'paint' | 'erase'
  manualPlacement: false,
  memoMode: false,
  paintGrade: 'better',
  manualGrade: 'better',
  manualShape: 'T',
  boards: {},                    // boardKey -> { cells, locked, pieceIds, pieceNotes }
  inventory: {},                 // gradeKey -> shapeKey -> count
  solveResult: null,             // { placements, unused }
  inventoryMode: 'normal',       // 'normal' | 'precise'
  unitMemo: [],                  // [{ id, grade, shape, effect, count }]
  precisePriority: {}            // memoId -> number | null (null/missing = 除外)
};

function initState() {
  state.boardsUsed = { segway: true, skateboard: false, horse: false };
  state.mainBoard = 'segway';
  state.paintMode = 'paint';
  state.manualPlacement = false;
  state.memoMode = false;
  state.paintGrade = 'better';
  state.manualGrade = 'better';
  state.manualShape = 'T';
  state.boards = {};
  state.inventory = {};
  state.solveResult = null;
  state.inventoryMode = 'normal';
  state.unitMemo = [];
  state.precisePriority = {};

  for (const key of BOARD_ORDER) {
    const { rows, cols } = BOARDS[key];
    state.boards[key] = {
      cells: Array.from({ length: rows }, () => Array(cols).fill(null)),
      locked: Array.from({ length: rows }, () => Array(cols).fill(false)),
      pieceIds: Array.from({ length: rows }, () => Array(cols).fill(null)),
      pieceNotes: {}
    };
  }
  for (const g of GRADES) {
    state.inventory[g.key] = {};
    for (const s of SHAPES) state.inventory[g.key][s] = 0;
  }
}

let memoIdSeq = 0;
function newMemoId() {
  memoIdSeq++;
  return `memo_${Date.now().toString(36)}_${memoIdSeq.toString(36)}`;
}

// === 永続化 (localStorage) ===
const STORAGE_KEY = 'unit-optimizer:v1';
const MODES_STORAGE_KEY = 'unit-optimizer:v2';
const DEFAULT_MODE_NAMES = ['Mode A', 'Mode B', 'Mode C'];
const MODE_COUNT = 3;

let modeStore = createDefaultModeStore();

function createDefaultModeStore() {
  return {
    activeMode: 0,
    modes: DEFAULT_MODE_NAMES.map(name => ({ name, snapshot: {} }))
  };
}

function serializeStateSnapshot() {
  return {
    boardsUsed: state.boardsUsed,
    mainBoard: state.mainBoard,
    paintGrade: state.paintGrade,
    paintMode: state.paintMode,
    manualGrade: state.manualGrade,
    manualShape: state.manualShape,
    boards: state.boards,
    inventory: state.inventory,
    solveResult: state.solveResult,
    inventoryMode: state.inventoryMode,
    unitMemo: state.unitMemo,
    precisePriority: state.precisePriority
  };
}

function applySnapshotToState(snap) {
  if (!snap || typeof snap !== 'object') return;

  if (snap.boardsUsed && typeof snap.boardsUsed === 'object') {
    for (const k of BOARD_ORDER) {
      if (typeof snap.boardsUsed[k] === 'boolean') state.boardsUsed[k] = snap.boardsUsed[k];
    }
  }
  if (BOARD_ORDER.includes(snap.mainBoard)) state.mainBoard = snap.mainBoard;
  if (gradeMap[snap.paintGrade])  state.paintGrade  = snap.paintGrade;
  if (['paint', 'erase'].includes(snap.paintMode)) state.paintMode = snap.paintMode;
  if (gradeMap[snap.manualGrade]) state.manualGrade = snap.manualGrade;
  if (SHAPES.includes(snap.manualShape)) state.manualShape = snap.manualShape;

  // 盤面: サイズが一致する時のみ採用 (仕様変更時の破損回避)
  if (snap.boards && typeof snap.boards === 'object') {
    for (const k of BOARD_ORDER) {
      const meta = BOARDS[k];
      const saved = snap.boards[k];
      if (!saved || !Array.isArray(saved.cells) || !Array.isArray(saved.locked)) continue;
      if (saved.cells.length !== meta.rows) continue;
      if (!saved.cells.every(row => Array.isArray(row) && row.length === meta.cols)) continue;
      state.boards[k].cells  = saved.cells.map(r => r.map(v => (gradeMap[v] ? v : null)));
      state.boards[k].locked = saved.locked.map(r => r.map(v => !!v));
      if (
        Array.isArray(saved.pieceIds) &&
        saved.pieceIds.length === meta.rows &&
        saved.pieceIds.every(row => Array.isArray(row) && row.length === meta.cols)
      ) {
        state.boards[k].pieceIds = saved.pieceIds.map(r => r.map(v => (typeof v === 'string' ? v : null)));
      } else {
        state.boards[k].pieceIds = Array.from({ length: meta.rows }, () => Array(meta.cols).fill(null));
      }
      state.boards[k].pieceNotes = sanitizePieceNotes(saved.pieceNotes);
      pruneOrphanNotes(state.boards[k]);
    }
  }

  // 在庫
  if (snap.inventory && typeof snap.inventory === 'object') {
    for (const g of GRADES) {
      const row = snap.inventory[g.key];
      if (!row) continue;
      for (const s of SHAPES) {
        const n = Number(row[s]);
        if (Number.isFinite(n) && n >= 0) state.inventory[g.key][s] = Math.floor(n);
      }
    }
  }

  // 未使用表示の復元
  if (snap.solveResult && Array.isArray(snap.solveResult.unused)) {
    state.solveResult = {
      placements: Array.isArray(snap.solveResult.placements) ? snap.solveResult.placements : [],
      unused: snap.solveResult.unused.filter(u => u && gradeMap[u.grade] && SHAPES.includes(u.shape))
    };
  }

  if (snap.inventoryMode === 'precise' || snap.inventoryMode === 'normal') {
    state.inventoryMode = snap.inventoryMode;
  }

  if (Array.isArray(snap.unitMemo)) {
    state.unitMemo = snap.unitMemo
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const grade = gradeMap[entry.grade] ? entry.grade : 'better';
        const shape = SHAPES.includes(entry.shape) ? entry.shape : 'O';
        const effect = EFFECT_KEYS.has(entry.effect) ? entry.effect : null;
        const count = Math.max(1, Math.min(99, Math.floor(Number(entry.count) || 1)));
        const id = typeof entry.id === 'string' && entry.id ? entry.id : newMemoId();
        return { id, grade, shape, effect, count };
      })
      .filter(Boolean);
  }

  if (snap.precisePriority && typeof snap.precisePriority === 'object') {
    const valid = {};
    const memoIds = new Set(state.unitMemo.map(m => m.id));
    for (const [id, raw] of Object.entries(snap.precisePriority)) {
      if (!memoIds.has(id)) continue;
      const n = Number(raw);
      if (Number.isFinite(n)) valid[id] = n;
    }
    state.precisePriority = valid;
  }
}

function sanitizePieceNotes(pieceNotes) {
  const clean = {};
  if (!pieceNotes || typeof pieceNotes !== 'object' || Array.isArray(pieceNotes)) return clean;
  for (const [pieceId, effectKey] of Object.entries(pieceNotes)) {
    if (typeof pieceId === 'string' && EFFECT_KEYS.has(effectKey)) clean[pieceId] = effectKey;
  }
  return clean;
}

function normalizeModeStore(rawStore) {
  const defaults = createDefaultModeStore();
  const normalized = createDefaultModeStore();
  const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
  const sourceModes = Array.isArray(source.modes) ? source.modes : [];

  for (let i = 0; i < MODE_COUNT; i++) {
    const mode = sourceModes[i] && typeof sourceModes[i] === 'object' ? sourceModes[i] : {};
    const name = typeof mode.name === 'string' ? mode.name.trim() : '';
    normalized.modes[i] = {
      name: name || defaults.modes[i].name,
      snapshot: mode.snapshot && typeof mode.snapshot === 'object' ? mode.snapshot : {}
    };
  }

  const active = Number(source.activeMode);
  normalized.activeMode = Number.isInteger(active) && active >= 0 && active < MODE_COUNT ? active : 0;
  return normalized;
}

function persistModeStore() {
  try {
    localStorage.setItem(MODES_STORAGE_KEY, JSON.stringify(modeStore));
  } catch (e) {
    // ストレージ不可 (プライベートモード等) はサイレントに無視
  }
}

function loadModeStore() {
  try {
    const rawV2 = localStorage.getItem(MODES_STORAGE_KEY);
    if (rawV2) {
      modeStore = normalizeModeStore(JSON.parse(rawV2));
      return;
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY);
    if (rawV1) {
      const migrated = createDefaultModeStore();
      const snap = JSON.parse(rawV1);
      migrated.modes[0].snapshot = snap && typeof snap === 'object' ? snap : {};
      modeStore = normalizeModeStore(migrated);
      persistModeStore();
      return;
    }
  } catch (e) {
    // パース失敗時はデフォルトのまま続行
  }
  modeStore = createDefaultModeStore();
}

function saveState() {
  modeStore.modes[modeStore.activeMode].snapshot = serializeStateSnapshot();
  persistModeStore();
}

function loadState() {
  loadModeStore();
  applySnapshotToState(modeStore.modes[modeStore.activeMode].snapshot);
}

// === DOM参照 ===
const el = {};
function cacheEls() {
  el.modeTabs = document.getElementById('modeTabs');
  el.boardSelect = document.getElementById('boardSelect');
  el.boards = document.getElementById('boards');
  el.paintGrade = document.getElementById('paintGrade');
  el.paintToggle = document.getElementById('paintToggle');
  el.eraseToggle = document.getElementById('eraseToggle');
  el.manualToggle = document.getElementById('manualToggle');
  el.memoToggle = document.getElementById('memoToggle');
  el.resetBoard = document.getElementById('resetBoard');
  el.solveBtn = document.getElementById('solveBtn');
  el.status = document.getElementById('status');
  el.inventory = document.getElementById('inventory');
  el.preciseInputs = document.getElementById('preciseInputs');
  el.inventoryHint = document.getElementById('inventoryHint');
  el.invModeNormal = document.getElementById('invModeNormal');
  el.invModePrecise = document.getElementById('invModePrecise');
  el.memoSection = document.getElementById('memoSection');
  el.memoList = document.getElementById('memoList');
  el.memoAddBtn = document.getElementById('memoAddBtn');
  el.unusedPanel = document.getElementById('unusedPanel');
  el.unusedList = document.getElementById('unusedList');
}

// === 初期化 ===
function init() {
  cacheEls();
  initState();
  loadState();

  // 塗る用品質セレクト
  for (const g of GRADES) {
    const opt = document.createElement('option');
    opt.value = g.key;
    opt.textContent = g.label;
    el.paintGrade.append(opt);
  }
  el.paintGrade.value = state.paintGrade;
  el.paintGrade.addEventListener('change', () => {
    state.paintGrade = el.paintGrade.value;
    saveState();
  });

  el.paintToggle.addEventListener('click', () => setPaintMode('paint'));
  el.eraseToggle.addEventListener('click', () => setPaintMode('erase'));
  el.manualToggle.addEventListener('click', () => toggleManual());
  el.memoToggle.addEventListener('click', () => toggleMemo());
  el.resetBoard.addEventListener('click', resetBoards);
  el.solveBtn.addEventListener('click', () => runSolve({ precise: state.inventoryMode === 'precise' }));

  el.invModeNormal.addEventListener('click', () => setInventoryMode('normal'));
  el.invModePrecise.addEventListener('click', () => setInventoryMode('precise'));
  el.memoAddBtn.addEventListener('click', addMemoEntry);

  renderModeTabs();
  renderBoardSelect();
  renderBoards();
  renderInventory();
  renderUnused();
}

function setInventoryMode(mode) {
  if (mode !== 'normal' && mode !== 'precise') return;
  if (state.inventoryMode === mode) return;
  state.inventoryMode = mode;
  saveState();
  renderInventory();
}

// === モードタブ UI ===
function renderModeTabs() {
  el.modeTabs.innerHTML = '';
  modeStore.modes.forEach((mode, idx) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'mode-tab';
    tab.dataset.idx = String(idx);
    tab.textContent = mode.name;
    tab.title = mode.name;
    if (idx === modeStore.activeMode) {
      tab.classList.add('active');
      tab.setAttribute('aria-current', 'page');
    }
    tab.addEventListener('click', () => switchMode(idx));
    el.modeTabs.append(tab);

    if (idx === modeStore.activeMode) {
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'mode-rename';
      rename.setAttribute('aria-label', 'rename');
      rename.title = 'モード名を変更';
      rename.textContent = '✎';
      rename.addEventListener('click', () => renameMode(idx));
      el.modeTabs.append(rename);
    }
  });
}

function switchMode(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= MODE_COUNT || idx === modeStore.activeMode) return;

  saveState();
  modeStore.activeMode = idx;
  persistModeStore();

  hideManualPicker();
  hideMemoPicker();
  initState();
  applySnapshotToState(modeStore.modes[idx].snapshot);
  syncControlsToState();
  renderModeTabs();
  renderBoardSelect();
  renderBoards();
  renderInventory();
  renderUnused();
  setStatus(`${modeStore.modes[idx].name} に切り替えました`);
}

function renameMode(idx) {
  if (!Number.isInteger(idx) || idx < 0 || idx >= MODE_COUNT) return;
  const current = modeStore.modes[idx].name;
  const input = prompt('モード名を入力', current);
  if (input === null) return;
  const trimmed = input.trim();
  modeStore.modes[idx].name = trimmed && trimmed.length <= 15 ? trimmed : DEFAULT_MODE_NAMES[idx];
  persistModeStore();
  renderModeTabs();
}

function syncControlsToState() {
  el.paintGrade.value = state.paintGrade;
  el.paintToggle.classList.toggle('active', state.paintMode === 'paint' && !state.memoMode);
  el.eraseToggle.classList.toggle('active', state.paintMode === 'erase' && !state.memoMode);
  el.manualToggle.classList.toggle('active', state.manualPlacement);
  el.memoToggle.classList.toggle('active', state.memoMode);
  el.invModeNormal.classList.toggle('active', state.inventoryMode !== 'precise');
  el.invModePrecise.classList.toggle('active', state.inventoryMode === 'precise');
}

// === 盤選択 UI ===
function renderBoardSelect() {
  el.boardSelect.innerHTML = '';
  for (const key of BOARD_ORDER) {
    const b = BOARDS[key];
    const card = document.createElement('div');
    card.className = 'board-opt';
    card.style.setProperty('--board-color', b.color);
    card.dataset.board = key;
    if (state.boardsUsed[key]) card.classList.add('used');
    if (state.mainBoard === key) card.classList.add('main');

    const title = document.createElement('div');
    title.className = 'board-opt-title';
    title.textContent = `${b.name} (${b.alias})`;

    const useLabel = document.createElement('label');
    useLabel.className = 'chk';
    const useChk = document.createElement('input');
    useChk.type = 'checkbox';
    useChk.checked = state.boardsUsed[key];
    useChk.addEventListener('change', () => {
      state.boardsUsed[key] = useChk.checked;
      if (!useChk.checked && state.mainBoard === key) {
        state.mainBoard = BOARD_ORDER.find(k => state.boardsUsed[k]) || null;
      }
      if (useChk.checked && !state.mainBoard) state.mainBoard = key;
      saveState();
      renderBoardSelect();
      renderBoards();
    });
    useLabel.append(useChk, document.createTextNode(' 使用'));

    const mainLabel = document.createElement('label');
    mainLabel.className = 'chk';
    const mainRadio = document.createElement('input');
    mainRadio.type = 'radio';
    mainRadio.name = 'mainBoard';
    mainRadio.checked = state.mainBoard === key;
    mainRadio.disabled = !state.boardsUsed[key];
    mainRadio.addEventListener('change', () => {
      if (!state.boardsUsed[key]) return;
      state.mainBoard = key;
      saveState();
      renderBoardSelect();
      renderBoards();
    });
    mainLabel.append(mainRadio, document.createTextNode(' メイン'));

    card.append(title, useLabel, mainLabel);
    el.boardSelect.append(card);
  }
}

// === 盤のレンダリング ===
function renderBoards() {
  el.boards.innerHTML = '';
  const keys = selectedBoardKeys();
  if (keys.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'hint-text';
    empty.textContent = '使用する盤を選択してください。';
    el.boards.append(empty);
    return;
  }
  for (const key of keys) renderOneBoard(key);
}

function selectedBoardKeys() {
  const used = BOARD_ORDER.filter(k => state.boardsUsed[k]);
  if (!used.length) return [];
  used.sort((a, b) => {
    if (a === state.mainBoard) return -1;
    if (b === state.mainBoard) return 1;
    return 0;
  });
  return used;
}

function renderOneBoard(key) {
  const meta = BOARDS[key];
  const bs = state.boards[key];

  const wrap = document.createElement('div');
  wrap.className = 'board-wrap';
  wrap.style.setProperty('--board-color', meta.color);
  if (state.mainBoard === key) wrap.classList.add('main');

  const title = document.createElement('div');
  title.className = 'board-title';
  const badge = state.mainBoard === key ? ' ★メイン' : '';
  title.textContent = `${meta.name} (${meta.alias})${badge}`;
  wrap.append(title);

  const grid = document.createElement('div');
  grid.className = 'board';
  grid.style.gridTemplateColumns = `repeat(${meta.cols}, var(--cell))`;
  grid.style.gridTemplateRows = `repeat(${meta.rows}, var(--cell))`;

  const lines = fullLinesOf(bs.cells);
  const anchors = computePieceAnchors(bs.pieceIds, meta);

  for (let r = 0; r < meta.rows; r++) {
    for (let c = 0; c < meta.cols; c++) {
      const div = document.createElement('div');
      div.className = 'cell';
      const grade = bs.cells[r][c];
      if (grade) {
        const g = gradeMap[grade];
        div.style.background = g.hex;
        if (g.sparkle) div.classList.add('sparkle');
      }
      const myPieceId = bs.pieceIds[r][c];
      if (myPieceId) {
        const edges = [];
        const neighborDiffers = (rr, cc) =>
          rr < 0 || rr >= meta.rows || cc < 0 || cc >= meta.cols || bs.pieceIds[rr][cc] !== myPieceId;
        if (neighborDiffers(r - 1, c)) edges.push('inset 0 2px 0 0 #0008', 'inset 0 3px 0 0 #fff9');
        if (neighborDiffers(r + 1, c)) edges.push('inset 0 -2px 0 0 #0008', 'inset 0 -3px 0 0 #fff9');
        if (neighborDiffers(r, c - 1)) edges.push('inset 2px 0 0 0 #0008', 'inset 3px 0 0 0 #fff9');
        if (neighborDiffers(r, c + 1)) edges.push('inset -2px 0 0 0 #0008', 'inset -3px 0 0 0 #fff9');
        if (edges.length) div.style.boxShadow = edges.join(', ');
      }
      if (myPieceId && anchors[myPieceId]?.r === r && anchors[myPieceId]?.c === c) {
        const noteKey = bs.pieceNotes?.[myPieceId];
        if (EFFECT_KEYS.has(noteKey)) {
          const note = document.createElement('span');
          note.className = 'cell-note';
          note.textContent = noteKey;
          div.append(note);
        }
      }
      if (bs.locked[r][c]) div.classList.add('prefilled');
      div.addEventListener('click', () => onCellClick(key, r, c, div));
      grid.append(div);
    }
  }
  wrap.append(grid);

  const info = document.createElement('div');
  info.className = 'board-info';
  info.textContent = `揃ったライン: ${lines.length} / ${meta.rows}`;
  wrap.append(info);

  el.boards.append(wrap);
}

function computePieceAnchors(pieceIds, meta) {
  const anchors = {};
  for (let r = 0; r < meta.rows; r++) {
    for (let c = 0; c < meta.cols; c++) {
      const pieceId = pieceIds[r][c];
      if (pieceId && !anchors[pieceId]) anchors[pieceId] = { r, c };
    }
  }
  return anchors;
}

function fullLinesOf(cells) {
  const lines = [];
  for (let r = 0; r < cells.length; r++) {
    if (cells[r].every(isRealCell)) lines.push(r);
  }
  return lines;
}

// === クリック ===
function onCellClick(boardKey, r, c, cellEl) {
  if (state.memoMode) {
    tryEditPieceMemo(boardKey, r, c, cellEl);
    return;
  }
  if (state.manualPlacement) {
    tryManualPlace(boardKey, r, c);
    return;
  }
  const bs = state.boards[boardKey];
  const oldPieceId = bs.pieceIds[r][c];
  if (oldPieceId && bs.pieceNotes) delete bs.pieceNotes[oldPieceId];
  if (state.paintMode === 'erase') {
    bs.cells[r][c] = null;
    bs.locked[r][c] = false;
    bs.pieceIds[r][c] = null;
  } else {
    bs.cells[r][c] = state.paintGrade;
    bs.locked[r][c] = true;
    bs.pieceIds[r][c] = null;
  }
  pruneOrphanNotes(bs);
  state.solveResult = null;
  saveState();
  renderBoards();
  renderUnused();
}

// === モード切り替え ===
function setPaintMode(mode) {
  if (state.memoMode) toggleMemo(false);
  state.paintMode = mode;
  el.paintToggle.classList.toggle('active', mode === 'paint');
  el.eraseToggle.classList.toggle('active', mode === 'erase');
  if (state.manualPlacement) toggleManual(); // 強制的にOFF
  saveState();
}

function toggleManual(force) {
  if (state.memoMode) toggleMemo(false);
  state.manualPlacement = typeof force === 'boolean' ? force : !state.manualPlacement;
  el.manualToggle.classList.toggle('active', state.manualPlacement);
  if (state.manualPlacement) {
    el.paintToggle.classList.remove('active');
    el.eraseToggle.classList.remove('active');
    showManualPicker();
    setStatus('手動配置モード: 形状と品質を選択してから盤面をクリック');
  } else {
    syncControlsToState();
    hideManualPicker();
    setStatus('手動配置モード OFF');
  }
}

function toggleMemo(force) {
  state.memoMode = typeof force === 'boolean' ? force : !state.memoMode;
  el.memoToggle.classList.toggle('active', state.memoMode);
  if (state.memoMode) {
    if (state.manualPlacement) {
      state.manualPlacement = false;
      el.manualToggle.classList.remove('active');
    }
    el.paintToggle.classList.remove('active');
    el.eraseToggle.classList.remove('active');
    hideManualPicker();
    setStatus('メモモード: 配置済みピースをクリックして効果メモを設定');
  } else {
    hideMemoPicker();
    syncControlsToState();
    setStatus('メモモード OFF');
  }
}

// === 手動配置のピッカー (シンプルなポップオーバー) ===
let manualPicker = null;
function showManualPicker() {
  if (manualPicker) manualPicker.remove();
  manualPicker = document.createElement('div');
  manualPicker.className = 'manual-picker';

  const shapeLbl = document.createElement('label');
  shapeLbl.textContent = '形状 ';
  const shapeSel = document.createElement('select');
  for (const s of SHAPES) {
    const o = document.createElement('option');
    o.value = s; o.textContent = s; shapeSel.append(o);
  }
  shapeSel.value = state.manualShape;
  shapeSel.addEventListener('change', () => { state.manualShape = shapeSel.value; saveState(); });
  shapeLbl.append(shapeSel);

  const gradeLbl = document.createElement('label');
  gradeLbl.textContent = ' 品質 ';
  const gradeSel = document.createElement('select');
  for (const g of GRADES) {
    const o = document.createElement('option');
    o.value = g.key; o.textContent = g.label; gradeSel.append(o);
  }
  gradeSel.value = state.manualGrade;
  gradeSel.addEventListener('change', () => { state.manualGrade = gradeSel.value; saveState(); });
  gradeLbl.append(gradeSel);

  const note = document.createElement('span');
  note.className = 'hint-text';
  note.textContent = ' (回転はツールが自動で最適化時に考慮します)';

  manualPicker.append(shapeLbl, gradeLbl, note);
  el.manualToggle.after(manualPicker);
}
function hideManualPicker() {
  if (manualPicker) { manualPicker.remove(); manualPicker = null; }
}

// === 効果メモのピッカー ===
let memoPicker = null;
function tryEditPieceMemo(boardKey, r, c, cellEl) {
  const bs = state.boards[boardKey];
  const pieceId = bs.pieceIds[r][c];
  if (!pieceId) {
    hideMemoPicker();
    setStatus('メモ対象のピースがありません');
    return;
  }
  showMemoPicker(boardKey, pieceId, cellEl);
}

function showMemoPicker(boardKey, pieceId, cellEl) {
  hideMemoPicker();
  const bs = state.boards[boardKey];
  memoPicker = document.createElement('div');
  memoPicker.className = 'memo-picker';

  const select = document.createElement('select');
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '– / なし';
  select.append(emptyOpt);
  for (const effect of EFFECTS) {
    const opt = document.createElement('option');
    opt.value = effect.key;
    opt.textContent = `${effect.labelJa} / ${effect.labelEn}`;
    select.append(opt);
  }
  select.value = bs.pieceNotes?.[pieceId] || '';
  select.addEventListener('click', ev => ev.stopPropagation());
  select.addEventListener('change', () => {
    if (!bs.pieceNotes) bs.pieceNotes = {};
    if (EFFECT_KEYS.has(select.value)) bs.pieceNotes[pieceId] = select.value;
    else delete bs.pieceNotes[pieceId];
    saveState();
    renderBoards();
    hideMemoPicker();
    setStatus(select.value ? '効果メモを設定しました' : '効果メモを削除しました');
  });
  memoPicker.append(select);
  memoPicker.addEventListener('click', ev => ev.stopPropagation());

  const rect = cellEl.getBoundingClientRect();
  const left = Math.max(window.scrollX + 6, Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - 266));
  memoPicker.style.left = `${left}px`;
  memoPicker.style.top = `${rect.bottom + window.scrollY + 4}px`;
  document.body.append(memoPicker);
  select.focus();

  setTimeout(() => {
    document.addEventListener('click', onMemoOutsideClick, { capture: true });
  }, 0);
}

function onMemoOutsideClick(ev) {
  if (memoPicker && !memoPicker.contains(ev.target)) hideMemoPicker();
}

function hideMemoPicker() {
  if (memoPicker) {
    memoPicker.remove();
    memoPicker = null;
  }
  document.removeEventListener('click', onMemoOutsideClick, { capture: true });
}

function tryManualPlace(boardKey, r, c) {
  const bs = state.boards[boardKey];
  const meta = BOARDS[boardKey];
  const shape = state.manualShape;
  const grade = state.manualGrade;
  const pieceId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  // 全向きを試し、最初にフィットするものを採用
  for (const orient of SHAPE_ORIENTATIONS[shape]) {
    if (fitsAt(bs.cells, orient, r, c, meta)) {
      for (const [dr, dc] of orient) {
        bs.cells[r + dr][c + dc] = grade;
        bs.locked[r + dr][c + dc] = true;
        bs.pieceIds[r + dr][c + dc] = pieceId;
      }
      state.solveResult = null;
      saveState();
      renderBoards();
      renderUnused();
      setStatus(`手動配置: ${shape}(${gradeMap[grade].label}) @ (${r},${c})`);
      return;
    }
  }
  setStatus('配置できません / 重なる or はみ出す');
}

function fitsAt(cells, orient, r, c, meta) {
  for (const [dr, dc] of orient) {
    const rr = r + dr, cc = c + dc;
    if (rr < 0 || rr >= meta.rows || cc < 0 || cc >= meta.cols) return false;
    if (cells[rr][cc] !== null) return false;
  }
  return true;
}

// === 盤面リセット ===
function resetBoards() {
  for (const key of BOARD_ORDER) {
    const { rows, cols } = BOARDS[key];
    state.boards[key] = {
      cells: Array.from({ length: rows }, () => Array(cols).fill(null)),
      locked: Array.from({ length: rows }, () => Array(cols).fill(false)),
      pieceIds: Array.from({ length: rows }, () => Array(cols).fill(null)),
      pieceNotes: {}
    };
  }
  state.solveResult = null;
  saveState();
  renderBoards();
  renderUnused();
  setStatus('盤面リセット完了');
}

// === 所持ユニット UI (35 スロット) ===
function renderInventory() {
  const precise = state.inventoryMode === 'precise';
  el.invModeNormal.classList.toggle('active', !precise);
  el.invModePrecise.classList.toggle('active', precise);

  el.inventory.hidden = precise;
  el.preciseInputs.hidden = !precise;
  el.inventoryHint.textContent = precise
    ? 'ユニットメモを元に優先度を数値入力（小さい数=高優先、空欄=計算から除外）'
    : '各ユニットの所持数を入力';

  if (precise) {
    renderPreciseInputs();
  } else {
    renderNormalInventory();
  }
  renderMemoList();
}

function renderNormalInventory() {
  el.inventory.innerHTML = '';

  const table = document.createElement('div');
  table.className = 'inv-grid';

  // ヘッダ行: 形状
  table.append(cornerCell(''));
  for (const s of SHAPES) {
    const h = document.createElement('div');
    h.className = 'inv-head';
    h.textContent = s;
    table.append(h);
  }

  // 各品質 × 各形状
  for (const g of GRADES) {
    const rowHead = document.createElement('div');
    rowHead.className = 'inv-row-head';
    rowHead.style.setProperty('--grade-color', g.hex);
    if (g.sparkle) rowHead.classList.add('sparkle');
    rowHead.title = g.label;
    rowHead.textContent = g.label;
    table.append(rowHead);

    for (const s of SHAPES) {
      const cell = document.createElement('div');
      cell.className = 'inv-cell';

      const preview = document.createElement('div');
      preview.className = 'inv-preview';
      drawMiniShape(preview, s, g);
      cell.append(preview);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.inputMode = 'numeric';
      input.value = String(state.inventory[g.key][s] || 0);
      input.addEventListener('input', () => {
        const v = Math.max(0, Math.floor(Number(input.value) || 0));
        state.inventory[g.key][s] = v;
        saveState();
      });
      cell.append(input);

      table.append(cell);
    }
  }

  el.inventory.append(table);
}

function cornerCell(text) {
  const d = document.createElement('div');
  d.className = 'inv-corner';
  d.textContent = text;
  return d;
}

function drawMiniShape(container, shape, grade) {
  container.innerHTML = '';
  const coords = SHAPE_ORIENTATIONS[shape][0];
  const maxR = Math.max(...coords.map(c => c[0]));
  const maxC = Math.max(...coords.map(c => c[1]));
  const cell = 6;
  const w = (maxC + 1) * cell;
  const h = (maxR + 1) * cell;
  container.style.width = `${w}px`;
  container.style.height = `${h}px`;
  for (const [r, c] of coords) {
    const b = document.createElement('div');
    b.className = 'mini-block';
    b.style.left = `${c * cell}px`;
    b.style.top = `${r * cell}px`;
    b.style.width = `${cell}px`;
    b.style.height = `${cell}px`;
    b.style.background = grade.hex;
    if (grade.sparkle) b.classList.add('sparkle');
    container.append(b);
  }
}

// === 精密モード 優先度入力 ===
function renderPreciseInputs() {
  el.preciseInputs.innerHTML = '';
  if (!state.unitMemo.length) {
    const empty = document.createElement('div');
    empty.className = 'precise-empty';
    empty.textContent = 'ユニットメモが空です。下の「ユニットメモ」を開いて所持ユニットを追加してください。';
    el.preciseInputs.append(empty);
    return;
  }

  // 表示順: 優先度の小さい順 (除外は末尾)、同率はメモ追加順
  const annotated = state.unitMemo.map((m, idx) => {
    const raw = state.precisePriority[m.id];
    const pri = Number.isFinite(raw) ? Number(raw) : null;
    return { memo: m, idx, pri };
  });
  annotated.sort((a, b) => {
    if (a.pri === null && b.pri === null) return a.idx - b.idx;
    if (a.pri === null) return 1;
    if (b.pri === null) return -1;
    if (a.pri !== b.pri) return a.pri - b.pri;
    return a.idx - b.idx;
  });

  for (const { memo, pri } of annotated) {
    const row = document.createElement('div');
    row.className = 'precise-row';
    if (pri === null) row.classList.add('excluded');

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'pri-input';
    input.placeholder = '除外';
    input.inputMode = 'numeric';
    input.value = pri === null ? '' : String(pri);
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (v === '') delete state.precisePriority[memo.id];
      else {
        const n = Number(v);
        if (Number.isFinite(n)) state.precisePriority[memo.id] = n;
      }
      saveState();
    });
    input.addEventListener('blur', () => renderPreciseInputs());
    row.append(input);

    const g = gradeMap[memo.grade] || gradeMap.better;
    const swatch = document.createElement('span');
    swatch.className = 'pri-grade';
    swatch.style.background = g.hex;
    if (g.sparkle) swatch.classList.add('sparkle');
    swatch.title = g.label;
    row.append(swatch);

    const label = document.createElement('span');
    label.className = 'pri-label';
    label.textContent = `${memo.shape} / ${g.label}`;
    row.append(label);

    const effect = document.createElement('span');
    effect.className = 'pri-effect';
    if (memo.effect && EFFECT_KEYS.has(memo.effect)) {
      const def = EFFECTS.find(e => e.key === memo.effect);
      effect.textContent = memo.effect;
      effect.title = def ? `${def.labelJa} / ${def.labelEn}` : memo.effect;
    } else {
      effect.classList.add('none');
      effect.textContent = '–';
      effect.title = '効果なし';
    }
    row.append(effect);

    const count = document.createElement('span');
    count.className = 'pri-count';
    count.textContent = memo.count > 1 ? `× ${memo.count}` : '';
    row.append(count);

    el.preciseInputs.append(row);
  }
}

// === ユニットメモ UI ===
function renderMemoList() {
  el.memoList.innerHTML = '';
  if (!state.unitMemo.length) {
    const empty = document.createElement('div');
    empty.className = 'memo-empty';
    empty.textContent = 'まだメモがありません。「＋ ユニットを追加」から登録してください。';
    el.memoList.append(empty);
    return;
  }

  for (const memo of state.unitMemo) {
    const row = document.createElement('div');
    row.className = 'memo-row';

    const gradeSel = document.createElement('select');
    for (const g of GRADES) {
      const o = document.createElement('option');
      o.value = g.key;
      o.textContent = g.label;
      gradeSel.append(o);
    }
    gradeSel.value = memo.grade;
    gradeSel.addEventListener('change', () => {
      memo.grade = gradeSel.value;
      saveState();
      if (state.inventoryMode === 'precise') renderPreciseInputs();
    });
    row.append(gradeSel);

    const shapeSel = document.createElement('select');
    for (const s of SHAPES) {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s;
      shapeSel.append(o);
    }
    shapeSel.value = memo.shape;
    shapeSel.addEventListener('change', () => {
      memo.shape = shapeSel.value;
      saveState();
      if (state.inventoryMode === 'precise') renderPreciseInputs();
    });
    row.append(shapeSel);

    const effectSel = document.createElement('select');
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = '– 効果なし';
    effectSel.append(noneOpt);
    for (const e of EFFECTS) {
      const o = document.createElement('option');
      o.value = e.key;
      o.textContent = `${e.key} / ${e.labelJa}`;
      effectSel.append(o);
    }
    effectSel.value = memo.effect || '';
    effectSel.addEventListener('change', () => {
      memo.effect = EFFECT_KEYS.has(effectSel.value) ? effectSel.value : null;
      saveState();
      if (state.inventoryMode === 'precise') renderPreciseInputs();
    });
    row.append(effectSel);

    const countInput = document.createElement('input');
    countInput.type = 'number';
    countInput.min = '1';
    countInput.max = '99';
    countInput.inputMode = 'numeric';
    countInput.value = String(memo.count);
    countInput.addEventListener('input', () => {
      const v = Math.max(1, Math.min(99, Math.floor(Number(countInput.value) || 1)));
      memo.count = v;
      saveState();
      if (state.inventoryMode === 'precise') renderPreciseInputs();
    });
    row.append(countInput);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'memo-delete';
    del.textContent = '削除';
    del.addEventListener('click', () => {
      state.unitMemo = state.unitMemo.filter(m => m.id !== memo.id);
      delete state.precisePriority[memo.id];
      saveState();
      renderInventory();
    });
    row.append(del);

    el.memoList.append(row);
  }
}

function addMemoEntry() {
  const lastEntry = state.unitMemo[state.unitMemo.length - 1];
  const entry = {
    id: newMemoId(),
    grade: lastEntry ? lastEntry.grade : 'better',
    shape: lastEntry ? lastEntry.shape : 'O',
    effect: null,
    count: 1
  };
  state.unitMemo.push(entry);
  saveState();
  if (!el.memoSection.open) el.memoSection.open = true;
  renderInventory();
}

// === ソルバー ===
// 精密モードは探索空間が大きい入力でメインスレッドを長時間占有し、
// ブラウザから「応答なし」と判定されることがあった。
// 今後、精密モードの計算ロジックを差し替えやすいよう、通常/精密の
// 実行条件をプロファイルとして分離し、どちらも一定間隔で UI に制御を返す。
const SOLVER_PROFILES = {
  basic: { label: '基本', perBoardMs: 500, yieldEveryMs: 16, statusEveryMs: 200 },
  precise: { label: '精密', perBoardMs: 10000, yieldEveryMs: 8, statusEveryMs: 250 }
};

let solveInProgress = false;

async function runSolve(opts = { precise: false }) {
  if (solveInProgress) {
    setStatus('計算中です。完了までお待ちください');
    return;
  }

  const precise = !!opts.precise;
  const profile = precise ? SOLVER_PROFILES.precise : SOLVER_PROFILES.basic;
  const solveOpts = { _anyTimedOut: false };
  const keys = orderedBoardKeysForSolve(precise);
  if (keys.length === 0) {
    setStatus('使用する盤を選択してください');
    return;
  }

  let shapeInv;
  try {
    shapeInv = precise ? buildPreciseShapeInv() : buildNormalShapeInv();
  } catch (err) {
    setStatus(err.message || String(err));
    return;
  }

  const totalUnits = SHAPES.reduce((acc, s) => acc + shapeInv[s].length, 0);
  if (totalUnits === 0) {
    setStatus(precise
      ? '精密モード: 計算対象のユニットがありません (ユニットメモまたは優先度を確認)'
      : '所持ユニットが入力されていません');
    return;
  }

  solveInProgress = true;
  setControlsDisabled(true);
  setStatus(`[${profile.label}] 計算中...`);

  try {
    // 盤ごとに固定(locked)と既存配置の状態をコピー
    const boardStates = {};
    for (const k of keys) {
      boardStates[k] = {
        cells: state.boards[k].cells.map(r => r.slice()),
        locked: state.boards[k].locked.map(r => r.slice()),
        meta: BOARDS[k]
      };
    }

    // 既存の非ロックセルはソルバー用にクリア(前回の配置を消す)
    for (const k of keys) {
      keepNotesForLockedPieces(state.boards[k]);
      for (let r = 0; r < boardStates[k].meta.rows; r++) {
        for (let c = 0; c < boardStates[k].meta.cols; c++) {
          if (!boardStates[k].locked[r][c]) boardStates[k].cells[r][c] = null;
          if (!state.boards[k].locked[r][c]) state.boards[k].pieceIds[r][c] = null;
        }
      }
      pruneOrphanNotes(state.boards[k]);
    }

    const placements = []; // { boardKey, pieceId, grade, effect, memoId, cells }
    let pieceSeq = 0;

    // 盤の優先順: precise なら main > horse > skateboard > segway。
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const boardOpts = createSolverRunOptions(profile, k, i + 1, keys.length);
      const result = await solveBoard(boardStates[k], shapeInv, boardOpts);
      boardStates[k].cells = result.cellsSnapshot ?? boardStates[k].cells;

      // 採用された分だけ shapeInv からトップアイテムを消費 (先頭から取り除く)。
      for (const p of result.placements) {
        const unit = shapeInv[p.shape].shift();
        if (!unit) continue;
        pieceSeq++;
        const pid = `solve_${pieceSeq}_${unit.key}_${p.shape}`;
        const cells = p.orient.map(([dr, dc]) => [p.baseR + dr, p.baseC + dc]);
        placements.push({
          boardKey: k,
          pieceId: pid,
          grade: unit.key,
          effect: unit.effect || null,
          memoId: unit.memoId || null,
          cells
        });
      }
      if (boardOpts.timedOut) solveOpts._anyTimedOut = true;
      await yieldToBrowser();
    }

    // 反映
    for (const k of keys) {
      state.boards[k].cells = boardStates[k].cells;
      // locked は変更しない (ユーザー指定のみ locked)
    }
    for (const p of placements) {
      const bs = state.boards[p.boardKey];
      for (const [r, c] of p.cells) {
        bs.pieceIds[r][c] = p.pieceId;
        // セルの色は配置されたユニットの grade で確定
        bs.cells[r][c] = p.grade;
      }
      if (p.effect && EFFECT_KEYS.has(p.effect)) {
        if (!bs.pieceNotes) bs.pieceNotes = {};
        bs.pieceNotes[p.pieceId] = p.effect;
      }
    }

    // 残り (使わなかった) ユニットを未使用一覧として集計
    const unused = [];
    for (const s of SHAPES) {
      for (const unit of shapeInv[s]) {
        unused.push({ id: `${unit.key}_${s}_unused_${unused.length}`, grade: unit.key, shape: s });
      }
    }
    state.solveResult = { placements, unused };

    saveState();
    renderBoards();
    renderUnused();

    const msg = `[${profile.label}] 最適化完了: ${placements.length} 配置, 未使用 ${unused.length}`;
    const lineSummary = keys.map(k => `${BOARDS[k].name}=${fullLinesOf(boardStates[k].cells).length}`).join(', ');
    const timeoutMsg = solveOpts._anyTimedOut ? ` | ⚠ ${profile.perBoardMs / 1000}秒/盤の最良解を表示中` : '';
    setStatus(`${msg} | ラインs ${lineSummary}${timeoutMsg}`);
  } catch (err) {
    console.error(err);
    setStatus(`計算中にエラーが発生しました: ${err.message || err}`);
  } finally {
    solveInProgress = false;
    setControlsDisabled(false);
  }
}

function orderedBoardKeysForSolve(precise) {
  const used = BOARD_ORDER.filter(k => state.boardsUsed[k]);
  if (!used.length) return [];
  if (!precise) {
    return selectedBoardKeys(); // メイン先頭、他は BOARD_ORDER 順
  }
  // 精密モード: メイン → 馬 → スケボー → セグウェイ (使用中のもののみ)
  return used.slice().sort((a, b) => {
    if (a === state.mainBoard) return -1;
    if (b === state.mainBoard) return 1;
    return PRECISE_BOARD_RANK[a] - PRECISE_BOARD_RANK[b];
  });
}

// === ソルバー用ユニットプール構築 ===
// 各 shape ごとに、品質順 (normal) または優先度順 (precise) で
// 重み (weight) の降順に並んだユニット配列を返す。
// 各エントリ: { key: gradeKey, weight, sparkle, hex, label, effect?, memoId? }
function buildNormalShapeInv() {
  const shapeInv = {};
  for (const s of SHAPES) {
    const arr = [];
    for (const g of GRADES_DESC_PRIORITY) {
      const n = state.inventory[g.key][s] | 0;
      for (let i = 0; i < n; i++) {
        arr.push({ key: g.key, weight: g.priority, sparkle: g.sparkle, hex: g.hex, label: g.label, effect: null, memoId: null });
      }
    }
    shapeInv[s] = arr;
  }
  return shapeInv;
}

function buildPreciseShapeInv() {
  const active = [];
  for (const memo of state.unitMemo) {
    const raw = state.precisePriority[memo.id];
    const pri = Number.isFinite(raw) ? Number(raw) : null;
    if (pri === null) continue; // 除外
    active.push({ memo, pri });
  }
  if (!active.length) {
    throw new Error('精密モード: 優先度が設定されたユニットがありません');
  }
  // 重み: 高優先 (=数値が小さい) ほど高い weight を割り当てる。
  // weight = MAX_PRI + 1 - userPriority。範囲は >0 を保証 (weight 0 だと
  // upperBound の比較で「未配置と等価」とみなされる)。
  const maxPri = active.reduce((m, a) => Math.max(m, a.pri), 0);
  const minPri = active.reduce((m, a) => Math.min(m, a.pri), maxPri);
  const offset = Math.max(0, 1 - minPri); // minPri が 0 以下でも weight > 0 にする
  const weightOf = (pri) => (maxPri + 1 - pri) + offset;

  const shapeInv = {};
  for (const s of SHAPES) shapeInv[s] = [];

  for (const { memo, pri } of active) {
    const g = gradeMap[memo.grade] || gradeMap.better;
    const weight = weightOf(pri);
    for (let i = 0; i < memo.count; i++) {
      shapeInv[memo.shape].push({
        key: memo.grade,
        weight,
        sparkle: g.sparkle,
        hex: g.hex,
        label: g.label,
        effect: memo.effect || null,
        memoId: memo.id
      });
    }
  }

  // weight 降順 (高優先が先頭) にソート
  for (const s of SHAPES) {
    shapeInv[s].sort((a, b) => b.weight - a.weight);
  }
  return shapeInv;
}


function createSolverRunOptions(profile, boardKey, boardIndex, boardTotal) {
  const now = performance.now();
  return {
    profile,
    boardKey,
    boardIndex,
    boardTotal,
    deadline: now + profile.perBoardMs,
    nextYieldAt: now + profile.yieldEveryMs,
    nextStatusAt: now,
    nodes: 0,
    timedOut: false
  };
}

function setControlsDisabled(disabled) {
  document.querySelectorAll('button, select, input').forEach(control => {
    control.disabled = disabled;
  });
}

function maybeYieldSolver(opts) {
  opts.nodes++;
  const now = performance.now();
  if (now > opts.deadline) {
    opts.timedOut = true;
    return null;
  }
  if (now < opts.nextYieldAt) return null;

  if (now >= opts.nextStatusAt) {
    const remainingMs = Math.max(0, opts.deadline - now);
    setStatus(
      `[${opts.profile.label}] 計算中... ` +
      `${BOARDS[opts.boardKey].name} (${opts.boardIndex}/${opts.boardTotal}) ` +
      `残り約${Math.ceil(remainingMs / 1000)}秒`
    );
    opts.nextStatusAt = now + opts.profile.statusEveryMs;
  }

  opts.nextYieldAt = now + opts.profile.yieldEveryMs;
  return yieldToBrowser();
}

function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function collectPieceIds(bs, onlyLocked = false) {
  const ids = new Set();
  for (let r = 0; r < bs.pieceIds.length; r++) {
    for (let c = 0; c < bs.pieceIds[r].length; c++) {
      if ((!onlyLocked || bs.locked[r][c]) && bs.pieceIds[r][c]) ids.add(bs.pieceIds[r][c]);
    }
  }
  return ids;
}

function keepNotesForLockedPieces(bs) {
  const lockedIds = collectPieceIds(bs, true);
  filterPieceNotes(bs, lockedIds);
}

function pruneOrphanNotes(bs) {
  filterPieceNotes(bs, collectPieceIds(bs));
}

function filterPieceNotes(bs, validIds) {
  const notes = sanitizePieceNotes(bs.pieceNotes);
  for (const pieceId of Object.keys(notes)) {
    if (!validIds.has(pieceId)) delete notes[pieceId];
  }
  bs.pieceNotes = notes;
}

// === ペアマクロ (同形 2 個で 2×4 / 4×2 を作る) ===
// O,I,L,J は同形 2 個で長方形を作れるため、DFS の各ノードで「1 ステップで
// 8 セルを埋めるマクロ枝」として候補に加える。これにより探索深さが大幅に減る。
// T は同形ペアで長方形にならない & L+J も鏡像関係で回転のみではペア不可。
// マクロは単体配置と同列の DFS 枝として扱い、strict 順序にはしない (T が他形状と
// 同等に序盤から候補に上がるため、T の単体配置が後回しにならない)。
const MACROS = [
  { name: 'OO_H', shape: 'O', height: 2, width: 4, pieces: [
    { orient: SHAPE_ORIENTATIONS.O[0], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.O[0], dr: 0, dc: 2 }
  ]},
  { name: 'OO_V', shape: 'O', height: 4, width: 2, pieces: [
    { orient: SHAPE_ORIENTATIONS.O[0], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.O[0], dr: 2, dc: 0 }
  ]},
  { name: 'II_H', shape: 'I', height: 2, width: 4, pieces: [
    { orient: SHAPE_ORIENTATIONS.I[0], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.I[0], dr: 1, dc: 0 }
  ]},
  { name: 'II_V', shape: 'I', height: 4, width: 2, pieces: [
    { orient: SHAPE_ORIENTATIONS.I[1], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.I[1], dr: 0, dc: 1 }
  ]},
  { name: 'LL_H', shape: 'L', height: 2, width: 4, pieces: [
    { orient: SHAPE_ORIENTATIONS.L[1], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.L[3], dr: 0, dc: 1 }
  ]},
  { name: 'LL_V', shape: 'L', height: 4, width: 2, pieces: [
    { orient: SHAPE_ORIENTATIONS.L[2], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.L[0], dr: 1, dc: 0 }
  ]},
  { name: 'JJ_H', shape: 'J', height: 2, width: 4, pieces: [
    { orient: SHAPE_ORIENTATIONS.J[1], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.J[3], dr: 0, dc: 1 }
  ]},
  { name: 'JJ_V', shape: 'J', height: 4, width: 2, pieces: [
    { orient: SHAPE_ORIENTATIONS.J[2], dr: 0, dc: 0 },
    { orient: SHAPE_ORIENTATIONS.J[0], dr: 1, dc: 0 }
  ]}
];

function canPlaceMacro(cells, macro, baseR, baseC, meta) {
  if (baseR < 0 || baseC < 0) return false;
  if (baseR + macro.height > meta.rows || baseC + macro.width > meta.cols) return false;
  for (const p of macro.pieces) {
    for (const [dr, dc] of p.orient) {
      const r = baseR + p.dr + dr;
      const c = baseC + p.dc + dc;
      if (cells[r][c] !== null) return false;
    }
  }
  return true;
}

function placeMacro(cells, macro, baseR, baseC) {
  for (const p of macro.pieces) {
    for (const [dr, dc] of p.orient) {
      cells[baseR + p.dr + dr][baseC + p.dc + dc] = macro.shape;
    }
  }
}

function unplaceMacro(cells, macro, baseR, baseC) {
  for (const p of macro.pieces) {
    for (const [dr, dc] of p.orient) {
      cells[baseR + p.dr + dr][baseC + p.dc + dc] = null;
    }
  }
}

// === 形状別 在庫プール ===
// DFS は shape 次元のみで分岐し、品質/優先度 (weight) は配置確定後に
// shape ごと「在庫上位 weight から順」に割り当てる。配置位置によって
// 最適 weight 配分は変わらないため (qualitySum は使用枚数に対し単調)
// この decoupling は厳密最適を保つ。
// shapeInv[s] は { key, weight, ..., effect?, memoId? } の配列で weight 降順。

function computeQualityPrefix(shapeInv) {
  const pre = {};
  for (const s of SHAPES) {
    const arr = shapeInv[s];
    const p = new Array(arr.length + 1);
    p[0] = 0;
    for (let i = 0; i < arr.length; i++) p[i + 1] = p[i] + arr[i].weight;
    pre[s] = p;
  }
  return pre;
}

function assignGradesToPlacements(placements, shapeInv) {
  const pool = {};
  for (const s of SHAPES) pool[s] = shapeInv[s].slice();
  return placements.map(p => {
    const unit = pool[p.shape].shift();
    return { ...p, grade: unit.key, effect: unit.effect || null, memoId: unit.memoId || null };
  });
}

function rewriteCellsWithGrades(cellsSnapshot, placementsWithGrade) {
  for (const p of placementsWithGrade) {
    for (const [dr, dc] of p.orient) {
      cellsSnapshot[p.baseR + dr][p.baseC + dc] = p.grade;
    }
  }
}

// 貪欲法で素早く一解を作り、DFS の初期 best としてシードする。
// 左上から空セルを順に埋め、「次に使われるユニットの weight が高い shape」を優先。
// 置けないセルは __SKIP__ として残し、最後に null へ戻す。
function greedySeed(boardState, shapeInv, qualityPrefix, meta) {
  const cells = snapshotCells(boardState.cells);
  const shapeCount = {};
  for (const s of SHAPES) shapeCount[s] = shapeInv[s].length;
  const used = Object.fromEntries(SHAPES.map(s => [s, 0]));
  const placements = [];

  while (true) {
    const empty = findNextEmpty(cells, meta);
    if (!empty) break;

    let placed = false;

    // マクロ優先: 1 ステップで 8 セル充填し、greedy が高速に盤を埋める。
    for (const macro of MACROS) {
      if (used[macro.shape] + 2 > shapeCount[macro.shape]) continue;
      if (!canPlaceMacro(cells, macro, empty.r, empty.c, meta)) continue;
      placeMacro(cells, macro, empty.r, empty.c);
      used[macro.shape] += 2;
      for (const p of macro.pieces) {
        placements.push({
          shape: macro.shape,
          orient: p.orient,
          baseR: empty.r + p.dr,
          baseC: empty.c + p.dc
        });
      }
      placed = true;
      break;
    }

    if (!placed) {
      const order = SHAPES
        .filter(s => used[s] < shapeCount[s])
        .sort((a, b) => shapeInv[b][used[b]].weight - shapeInv[a][used[a]].weight);

      outer: for (const s of order) {
        for (const orient of SHAPE_ORIENTATIONS[s]) {
          for (let i = 0; i < orient.length; i++) {
            const [dr, dc] = orient[i];
            const baseR = empty.r - dr;
            const baseC = empty.c - dc;
            if (!canPlaceOrient(cells, orient, baseR, baseC, meta)) continue;
            place(cells, orient, baseR, baseC, s);
            used[s]++;
            placements.push({ shape: s, orient, baseR, baseC });
            placed = true;
            break outer;
          }
        }
      }
    }
    if (!placed) cells[empty.r][empty.c] = '__SKIP__';
  }

  removeSkipSentinels(cells, meta);

  let qualitySum = 0;
  for (const s of SHAPES) qualitySum += qualityPrefix[s][used[s]];

  const placementsWithGrade = assignGradesToPlacements(placements, shapeInv);
  rewriteCellsWithGrades(cells, placementsWithGrade);

  return {
    score: scoreSnapshot(cells, qualitySum),
    cellsSnapshot: cells,
    placements: placementsWithGrade
  };
}

async function solveBoard(boardState, shapeInv, opts) {
  const { meta } = boardState;

  const qualityPrefix = computeQualityPrefix(shapeInv);
  const remaining = {};
  const used = {};
  for (const s of SHAPES) {
    remaining[s] = shapeInv[s].length;
    used[s] = 0;
  }

  let best = { score: [-1, -1, -Infinity, -Infinity], cellsSnapshot: null, placements: [] };
  const currentPlacements = [];

  const seed = greedySeed(boardState, shapeInv, qualityPrefix, meta);
  if (seed && compareScores(seed.score, best.score) > 0) {
    best = seed;
  }

  function curQualitySum() {
    let q = 0;
    for (const s of SHAPES) q += qualityPrefix[s][used[s]];
    return q;
  }

  function considerCurrent() {
    const sc = scoreSnapshot(boardState.cells, curQualitySum());
    if (compareScores(sc, best.score) > 0) {
      best = {
        score: sc,
        cellsSnapshot: snapshotCells(boardState.cells),
        placements: currentPlacements.map(p => ({ ...p }))
      };
    }
  }

  async function dfs() {
    considerCurrent();
    const pause = maybeYieldSolver(opts);
    if (pause) await pause;
    if (opts.timedOut) return;

    const ub = upperBound(boardState, shapeInv, used, curQualitySum());
    if (compareScores(ub, best.score) <= 0) return;

    const empty = findNextEmpty(boardState.cells, meta, remaining);
    if (!empty) return;

    // マクロ枝: 同形 2 個で 8 セル一気に充填。深さを半減させ枝幅は狭い。
    // empty は findNextEmpty が返す scan 順最初の空セルなので、マクロを
    // empty に top-left アンカーしたパターンだけ試せば十分 (他のアンカーは
    // 別ノードでカバーされる)。
    for (const macro of MACROS) {
      if (remaining[macro.shape] < 2) continue;
      if (!canPlaceMacro(boardState.cells, macro, empty.r, empty.c, meta)) continue;

      placeMacro(boardState.cells, macro, empty.r, empty.c);
      remaining[macro.shape] -= 2;
      used[macro.shape] += 2;
      for (const p of macro.pieces) {
        currentPlacements.push({
          shape: macro.shape,
          orient: p.orient,
          baseR: empty.r + p.dr,
          baseC: empty.c + p.dc
        });
      }

      await dfs();

      currentPlacements.pop();
      currentPlacements.pop();
      used[macro.shape] -= 2;
      remaining[macro.shape] += 2;
      unplaceMacro(boardState.cells, macro, empty.r, empty.c);

      if (opts.timedOut) return;
    }

    // 単体枝: マクロが入らない/作れない形状 (T含む) もここで試行されるため
    // T が後回しにならない。
    const shapeOrder = SHAPES
      .filter(s => remaining[s] > 0)
      .sort((a, b) => shapeInv[b][used[b]].weight - shapeInv[a][used[a]].weight);

    for (const s of shapeOrder) {
      for (const orient of SHAPE_ORIENTATIONS[s]) {
        for (let i = 0; i < orient.length; i++) {
          const [dr, dc] = orient[i];
          const baseR = empty.r - dr;
          const baseC = empty.c - dc;
          if (!isAnchorCell(orient, i, empty, baseR, baseC)) continue;
          if (!canPlaceOrient(boardState.cells, orient, baseR, baseC, meta)) continue;

          place(boardState.cells, orient, baseR, baseC, s);
          remaining[s]--;
          used[s]++;
          currentPlacements.push({ shape: s, orient, baseR, baseC });

          await dfs();

          currentPlacements.pop();
          used[s]--;
          remaining[s]++;
          unplace(boardState.cells, orient, baseR, baseC);

          if (opts.timedOut) return;
        }
      }
    }

    boardState.cells[empty.r][empty.c] = '__SKIP__';
    await dfs();
    boardState.cells[empty.r][empty.c] = null;
  }

  await dfs();

  // best.placements は seed 由来なら grade 付き、DFS 由来なら未割当 → post-hoc 割当。
  let placementsWithGrade;
  if (best.placements.length > 0 && best.placements[0].grade) {
    placementsWithGrade = best.placements;
    if (best.cellsSnapshot) removeSkipSentinels(best.cellsSnapshot, meta);
  } else {
    placementsWithGrade = assignGradesToPlacements(best.placements, shapeInv);
    if (best.cellsSnapshot) {
      removeSkipSentinels(best.cellsSnapshot, meta);
      rewriteCellsWithGrades(best.cellsSnapshot, placementsWithGrade);
    }
  }

  return {
    score: best.score,
    cellsSnapshot: best.cellsSnapshot,
    placements: placementsWithGrade
  };
}

function snapshotCells(cells) {
  return cells.map(r => r.slice());
}

function removeSkipSentinels(cells, meta) {
  for (let r = 0; r < meta.rows; r++) {
    for (let c = 0; c < meta.cols; c++) {
      if (cells[r][c] === '__SKIP__') cells[r][c] = null;
    }
  }
}

function scoreSnapshot(cells, placedQualitySum) {
  return [
    fullLinesOf(cells).length,
    countRealCells(cells),
    placedQualitySum,
    gapShapeBonus(cells)
  ];
}

function compareScores(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function upperBound(boardState, shapeInv, used, qualitySum) {
  const { cells, meta } = boardState;
  let emptyCount = 0;
  let remainingPieces = 0;
  for (const s of SHAPES) remainingPieces += shapeInv[s].length - used[s];

  let ubLines = 0;
  for (let r = 0; r < meta.rows; r++) {
    let real = 0;
    let empty = 0;
    for (let c = 0; c < meta.cols; c++) {
      if (cells[r][c] === null) empty++;
      else if (isRealCell(cells[r][c])) real++;
    }
    emptyCount += empty;
    if (real + empty >= meta.cols) ubLines++;
  }

  // 実際に置けるピース数の上限 = min(残ピース, floor(空セル/4))。
  // weight 上界は残ピースを高 weight 順に placeable 個取って加算。
  // 各 shape の shapeInv は weight 降順ソート済 & used[s] は先頭から消費
  // されるので、ptr[s] = used[s] を初期値に 5-way マージで top-k を取れば良い。
  const placeable = Math.min(remainingPieces, Math.floor(emptyCount / 4));
  let ubQualityAdd = 0;
  const ptr = {};
  for (const s of SHAPES) ptr[s] = used[s];
  for (let k = 0; k < placeable; k++) {
    let bestShape = null;
    let bestWeight = -Infinity;
    for (const s of SHAPES) {
      const arr = shapeInv[s];
      if (ptr[s] >= arr.length) continue;
      const w = arr[ptr[s]].weight;
      if (w > bestWeight) { bestWeight = w; bestShape = s; }
    }
    if (bestShape === null) break;
    ubQualityAdd += bestWeight;
    ptr[bestShape]++;
  }

  const totalCells = meta.rows * meta.cols;
  const ubFilled = countRealCells(cells) + Math.min(emptyCount, 4 * remainingPieces);
  const ubGapBonus = ubFilled >= totalCells ? 0 : Math.floor((totalCells - ubFilled) / 4);
  return [ubLines, ubFilled, qualitySum + ubQualityAdd, ubGapBonus];
}

function findNextEmpty(cells, meta, remaining = null) {
  let fallback = null;
  let best = null;
  let bestCount = Infinity;

  for (let r = 0; r < meta.rows; r++) {
    for (let c = 0; c < meta.cols; c++) {
      if (cells[r][c] !== null) continue;
      const candidate = { r, c };
      if (!fallback) fallback = candidate;
      if (!remaining) return candidate;

      const count = countCandidatesForCell(cells, meta, remaining, candidate);
      if (count < bestCount) {
        best = candidate;
        bestCount = count;
        if (count === 0) return best;
      }
    }
  }

  return best || fallback;
}

function countCandidatesForCell(cells, meta, remaining, empty) {
  let count = 0;
  for (const s of SHAPES) {
    if (remaining[s] === 0) continue;
    for (const orient of SHAPE_ORIENTATIONS[s]) {
      for (let i = 0; i < orient.length; i++) {
        const [dr, dc] = orient[i];
        const baseR = empty.r - dr;
        const baseC = empty.c - dc;
        if (!isAnchorCell(orient, i, empty, baseR, baseC)) continue;
        if (canPlaceOrient(cells, orient, baseR, baseC, meta)) count++;
      }
    }
  }
  return count;
}

function canPlaceOrient(cells, orient, baseR, baseC, meta) {
  for (const [dr, dc] of orient) {
    const r = baseR + dr, c = baseC + dc;
    if (r < 0 || r >= meta.rows || c < 0 || c >= meta.cols) return false;
    if (cells[r][c] !== null) return false;
  }
  return true;
}

function isAnchorCell(orient, idx, empty, baseR, baseC) {
  const target = [empty.r - baseR, empty.c - baseC];
  let min = null;
  for (const [dr, dc] of orient) {
    if (baseR + dr !== empty.r || baseC + dc !== empty.c) continue;
    if (!min || dr < min[0] || (dr === min[0] && dc < min[1])) min = [dr, dc];
  }
  return !!min && orient[idx][0] === target[0] && orient[idx][1] === target[1] && target[0] === min[0] && target[1] === min[1];
}

function place(cells, orient, baseR, baseC, grade) {
  for (const [dr, dc] of orient) cells[baseR + dr][baseC + dc] = grade;
}

function unplace(cells, orient, baseR, baseC) {
  for (const [dr, dc] of orient) cells[baseR + dr][baseC + dc] = null;
}

function countRealCells(cells) {
  let count = 0;
  for (const row of cells) {
    for (const cell of row) {
      if (isRealCell(cell)) count++;
    }
  }
  return count;
}

function isRealCell(value) {
  return value !== null && value !== '__SKIP__';
}

function gapShapeBonus(cells) {
  const rows = cells.length;
  const cols = cells[0].length;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  let bonus = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c] !== null || visited[r][c]) continue;
      const region = floodFillGap(cells, visited, r, c);
      bonus += region.length === 4 && matchesAnyTetromino(region) ? 1 : -1;
    }
  }

  return bonus;
}

function floodFillGap(cells, visited, startR, startC) {
  const rows = cells.length;
  const cols = cells[0].length;
  const region = [];
  const stack = [[startR, startC]];

  while (stack.length) {
    const [r, c] = stack.pop();
    if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
    if (visited[r][c] || cells[r][c] !== null) continue;
    visited[r][c] = true;
    region.push([r, c]);
    stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }

  return region;
}

function matchesAnyTetromino(region) {
  return TETROMINO_NORMALIZED_KEYS.has(normalizeRegionKey(region));
}

function normalizeRegionKey(region) {
  const minR = Math.min(...region.map(p => p[0]));
  const minC = Math.min(...region.map(p => p[1]));
  const norm = region
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return JSON.stringify(norm);
}

const TETROMINO_NORMALIZED_KEYS = new Set(
  Object.values(SHAPE_ORIENTATIONS).flat().map(orient => normalizeRegionKey(orient))
);

// === 未使用ユニット表示 ===
function renderUnused() {
  const res = state.solveResult;
  if (!res || res.unused.length === 0) {
    el.unusedPanel.hidden = true;
    el.unusedList.innerHTML = '';
    return;
  }
  el.unusedPanel.hidden = false;
  el.unusedList.innerHTML = '';

  // 集計: grade × shape -> count
  const counts = {};
  for (const p of res.unused) {
    const k = `${p.grade}_${p.shape}`;
    counts[k] = (counts[k] || 0) + 1;
  }
  for (const [k, n] of Object.entries(counts)) {
    const [gradeKey, shape] = k.split('_');
    const g = gradeMap[gradeKey];
    const chip = document.createElement('div');
    chip.className = 'unused-chip';
    const preview = document.createElement('div');
    preview.className = 'inv-preview';
    drawMiniShape(preview, shape, g);
    chip.append(preview);
    const cnt = document.createElement('span');
    cnt.textContent = `× ${n}`;
    chip.append(cnt);
    el.unusedList.append(chip);
  }
}

function setStatus(msg) {
  el.status.textContent = msg;
}

init();
