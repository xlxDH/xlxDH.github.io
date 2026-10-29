/* ==========================================================================
 * arcade.js — 背景里的 FC 游戏机
 * ==========================================================================
 * · 5 秒没有操作 → 自动进入选单 → 随机挑一个游戏 → AI 自己玩
 * · 一旦有操作（键盘 / 点击 / 滚轮 / 输入）→ 立刻停下，回到选单
 * · 三个游戏：俄罗斯方块、贪吃蛇、打砖块，各自带一套启发式 AI
 * · 256×224 的逻辑分辨率 + 自绘 5×7 像素字体，放大后用 pixelated 渲染
 *
 * URL 参数：
 *   ?arcade=off            关掉
 *   ?arcade=tetris|snake|breakout   锁定某个游戏（调试 / 演示用）
 * ========================================================================== */
(() => {
  'use strict';

  const canvas = document.getElementById('arcade');
  if (!canvas || !canvas.getContext) return;

  const CONFIG = window.CONFIG || {};
  if (CONFIG.arcade === false) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const params = new URLSearchParams(location.search);
  const forced = (params.get('arcade') || '').toLowerCase();
  if (forced === 'off') return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const W = 256;
  const H = 224;
  canvas.width = W;
  canvas.height = H;

  const IDLE = Math.max(1500, Number(CONFIG.arcadeIdle) || 5000);
  const GAME_KEYS = ['tetris', 'snake', 'breakout'];
  const GAME_NAMES = ['TETRIS', 'SNAKE', 'BREAKOUT'];
  const forcedIndex = GAME_KEYS.indexOf(forced);

  /* ---------------------------------------------------------------- 工具 */
  const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
  const padScore = (value) => String(Math.max(0, Math.floor(value))).padStart(6, '0');

  /* ------------------------------------------------------------ 像素字体 */
  /* 5×7 点阵，每行 5 个字符，1 表示亮 */
  const FONT = {
    ' ': '00000|00000|00000|00000|00000|00000|00000',
    A: '01110|10001|10001|11111|10001|10001|10001',
    B: '11110|10001|10001|11110|10001|10001|11110',
    C: '01110|10001|10000|10000|10000|10001|01110',
    D: '11110|10001|10001|10001|10001|10001|11110',
    E: '11111|10000|10000|11110|10000|10000|11111',
    F: '11111|10000|10000|11110|10000|10000|10000',
    G: '01110|10001|10000|10111|10001|10001|01111',
    H: '10001|10001|10001|11111|10001|10001|10001',
    I: '11111|00100|00100|00100|00100|00100|11111',
    J: '00111|00010|00010|00010|00010|10010|01100',
    K: '10001|10010|10100|11000|10100|10010|10001',
    L: '10000|10000|10000|10000|10000|10000|11111',
    M: '10001|11011|10101|10101|10001|10001|10001',
    N: '10001|11001|10101|10011|10001|10001|10001',
    O: '01110|10001|10001|10001|10001|10001|01110',
    P: '11110|10001|10001|11110|10000|10000|10000',
    Q: '01110|10001|10001|10001|10101|10010|01101',
    R: '11110|10001|10001|11110|10100|10010|10001',
    S: '01111|10000|10000|01110|00001|00001|11110',
    T: '11111|00100|00100|00100|00100|00100|00100',
    U: '10001|10001|10001|10001|10001|10001|01110',
    V: '10001|10001|10001|10001|10001|01010|00100',
    W: '10001|10001|10001|10101|10101|11011|10001',
    X: '10001|10001|01010|00100|01010|10001|10001',
    Y: '10001|10001|01010|00100|00100|00100|00100',
    Z: '11111|00001|00010|00100|01000|10000|11111',
    0: '01110|10001|10011|10101|11001|10001|01110',
    1: '00100|01100|00100|00100|00100|00100|01110',
    2: '01110|10001|00001|00010|00100|01000|11111',
    3: '11110|00001|00001|01110|00001|00001|11110',
    4: '00010|00110|01010|10010|11111|00010|00010',
    5: '11111|10000|11110|00001|00001|10001|01110',
    6: '01110|10000|10000|11110|10001|10001|01110',
    7: '11111|00001|00010|00100|01000|01000|01000',
    8: '01110|10001|10001|01110|10001|10001|01110',
    9: '01110|10001|10001|01111|00001|00001|01110',
    ':': '00000|00100|00100|00000|00100|00100|00000',
    '-': '00000|00000|00000|11111|00000|00000|00000',
    '.': '00000|00000|00000|00000|00000|00000|00100',
    '!': '00100|00100|00100|00100|00100|00000|00100',
    '/': '00001|00001|00010|00100|01000|10000|10000',
    '>': '10000|01000|00100|00010|00100|01000|10000',
    '<': '00001|00010|00100|01000|00100|00010|00001',
    '+': '00000|00100|00100|11111|00100|00100|00000',
  };

  const GLYPH = {};
  Object.keys(FONT).forEach((key) => {
    GLYPH[key] = FONT[key].split('|');
  });

  function textWidth(text, scale) {
    const s = scale || 1;
    return String(text).length * 6 * s - s;
  }

  function drawText(text, x, y, color, scale) {
    const s = scale || 1;
    const content = String(text).toUpperCase();
    ctx.fillStyle = color;
    let cursor = Math.round(x);
    const top = Math.round(y);
    for (let i = 0; i < content.length; i += 1) {
      const glyph = GLYPH[content[i]] || GLYPH[' '];
      for (let row = 0; row < 7; row += 1) {
        const line = glyph[row];
        for (let col = 0; col < 5; col += 1) {
          if (line[col] === '1') ctx.fillRect(cursor + col * s, top + row * s, s, s);
        }
      }
      cursor += 6 * s;
    }
  }

  const drawTextCentered = (text, y, color, scale) =>
    drawText(text, Math.round((W - textWidth(text, scale)) / 2), y, color, scale);


  /* ---------------------------------------------------------------- 配色 */
  const SKINS = {
    dark: {
      bg: '#0a0f0c',
      ink: '#d8e7dd',
      dim: '#5f7368',
      a: '#4ade80',
      a2: '#2f9e5b',
      b: '#5cc8ff',
      c: '#ffd166',
      d: '#ff7b72',
      e: '#c792ea',
      band: '#17301f',
      bandInk: '#e6fff0',
      grid: '#1c2a22',
      pieces: ['', '#5cc8ff', '#ffd166', '#c792ea', '#4ade80', '#ff7b72', '#ff9f43', '#7dd3fc'],
    },
    light: {
      bg: '#eef2ed',
      ink: '#1b2620',
      dim: '#8aa193',
      a: '#15803d',
      a2: '#3fa96a',
      b: '#0369a1',
      c: '#a16207',
      d: '#be123c',
      e: '#6d28d9',
      band: '#cbe8d2',
      bandInk: '#0f2417',
      grid: '#d7e3d8',
      pieces: ['', '#0369a1', '#a16207', '#6d28d9', '#15803d', '#be123c', '#c2410c', '#2563eb'],
    },
  };

  const skin = () => (document.documentElement.dataset.theme === 'light' ? SKINS.light : SKINS.dark);

  /* ---------------------------------------------------------------- 尺寸 */
  function resize() {
    const fit = Math.min(window.innerWidth / W, window.innerHeight / H);
    const scale = fit >= 2 ? Math.floor(fit) : fit;
    canvas.style.width = `${Math.round(W * scale)}px`;
    canvas.style.height = `${Math.round(H * scale)}px`;
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* ---------------------------------------------------------------- 状态 */
  const state = {
    mode: 'menu',
    lastActivity: performance.now(),
    nextStart: 0,
    selected: 0,
    target: 0,
    pickEnd: 0,
    overAt: 0,
    game: null,
    kind: '',
    lastScore: 0,
    hi: 0,
  };

  try {
    state.hi = Number(localStorage.getItem('th.hi')) || 0;
  } catch (error) {
    state.hi = 0;
  }

  const saveHi = () => {
    try {
      localStorage.setItem('th.hi', String(Math.floor(state.hi)));
    } catch (error) {
      /* 忽略 */
    }
  };

  /* ---------------------------------------------------------------- 选单 */
  function drawIcon(index, x, y, color) {
    ctx.fillStyle = color;
    if (index === 0) {
      const unit = 3;
      const cells = [[1, 0], [0, 1], [1, 1], [2, 1]];
      cells.forEach(([cx, cy]) => ctx.fillRect(x + cx * unit, y + cy * unit, unit - 1, unit - 1));
      return;
    }
    if (index === 1) {
      const cells = [[0, 1], [1, 1], [2, 1], [2, 0], [3, 0]];
      cells.forEach(([cx, cy]) => ctx.fillRect(x + cx * 3, y + cy * 3, 2, 2));
      ctx.fillRect(x + 4, y + 9, 2, 2);
      return;
    }
    ctx.fillRect(x, y + 1, 5, 2);
    ctx.fillRect(x + 7, y + 1, 5, 2);
    ctx.fillRect(x + 8, y + 6, 2, 2);
    ctx.fillRect(x + 2, y + 10, 8, 2);
  }

  function remaining(now) {
    if (state.nextStart) return Math.max(0, state.nextStart - now);
    return Math.max(0, state.lastActivity + IDLE - now);
  }

  function drawMenu(now) {
    const p = skin();
    ctx.globalAlpha = 0.9;

    drawText('1UP', 8, 8, p.a, 1);
    drawText(padScore(state.lastScore), 30, 8, p.ink, 1);
    drawText('HI', W - 78, 8, p.a, 1);
    drawText(padScore(state.hi), W - 56, 8, p.ink, 1);

    drawTextCentered('GAME SELECT', 34, p.a, 1);
    ctx.fillStyle = p.grid;
    ctx.fillRect(66, 46, W - 132, 1);

    for (let i = 0; i < 3; i += 1) {
      const y = 66 + i * 26;
      const active = i === state.selected;

      drawIcon(i, 74, y - 3, active ? p.a : p.dim);
      drawText(GAME_NAMES[i], 96, y, active ? p.ink : p.dim, 1);

      if (active) {
        ctx.fillStyle = p.grid;
        ctx.fillRect(60, y + 10, W - 120, 1);
        if (Math.floor(now / 220) % 2 === 0) drawText('>', 56, y, p.a, 1);
      }
    }

    if (state.mode === 'pick') {
      drawTextCentered('PUSH START', 156, p.a, 1);
      const blocks = 12;
      const bw = 6;
      const gap = 3;
      const startX = Math.round((W - (blocks * (bw + gap) - gap)) / 2);
      ctx.fillStyle = p.a;
      for (let i = 0; i < blocks; i += 1) {
        ctx.fillRect(startX + i * (bw + gap), 174, bw, 5);
      }
    } else {
      const left = remaining(now);
      const secs = Math.max(0, Math.ceil(left / 1000));
      drawTextCentered(`AUTO START IN ${secs}`, 156, p.dim, 1);

      const total = state.nextStart ? 1600 : IDLE;
      const ratio = clamp(1 - left / total, 0, 1);
      const blocks = 12;
      const bw = 6;
      const gap = 3;
      const startX = Math.round((W - (blocks * (bw + gap) - gap)) / 2);
      const filled = Math.round(ratio * blocks);
      for (let i = 0; i < blocks; i += 1) {
        ctx.fillStyle = i < filled ? p.a : p.grid;
        ctx.fillRect(startX + i * (bw + gap), 174, bw, 5);
      }

      if (Math.floor(now / 480) % 2 === 0) {
        drawTextCentered('PRESS ANY KEY', 194, p.dim, 1);
      }
    }

    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------- 俄罗斯方块 */
  const SHAPES = {
    I: { m: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], c: 1 },
    O: { m: [[1, 1], [1, 1]], c: 2 },
    T: { m: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], c: 3 },
    S: { m: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], c: 4 },
    Z: { m: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], c: 5 },
    J: { m: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], c: 6 },
    L: { m: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], c: 7 },
  };

  function createTetris(seed) {
    const rng = mulberry32(seed);
    const COLS = 10;
    const ROWS = 20;
    const CELL = 8;
    const OX = 88;
    const OY = 38;

    const board = [];
    for (let y = 0; y < ROWS; y += 1) board.push(new Array(COLS).fill(0));

    let bag = [];
    let piece = null;
    let target = null;
    let dropTimer = 0;
    let moveTimer = 0;
    let clearRows = null;
    let clearUntil = 0;
    let lines = 0;
    let level = 1;
    let score = 0;
    let over = false;

    function rotate(m) {
      const n = m.length;
      const out = [];
      for (let y = 0; y < n; y += 1) {
        out.push(new Array(n).fill(0));
        for (let x = 0; x < n; x += 1) out[y][x] = m[n - 1 - x][y];
      }
      return out;
    }

    function fits(m, px, py) {
      for (let y = 0; y < m.length; y += 1) {
        for (let x = 0; x < m.length; x += 1) {
          if (!m[y][x]) continue;
          const bx = px + x;
          const by = py + y;
          if (bx < 0 || bx >= COLS || by >= ROWS) return false;
          if (by >= 0 && board[by][bx]) return false;
        }
      }
      return true;
    }

    function clearSim(sim) {
      let cleared = 0;
      for (let y = ROWS - 1; y >= 0; y -= 1) {
        if (sim[y].every((v) => v)) {
          sim.splice(y, 1);
          sim.unshift(new Array(COLS).fill(0));
          cleared += 1;
          y += 1;
        }
      }
      return cleared;
    }

    function evaluate(sim, cleared) {
      let holes = 0;
      let aggregate = 0;
      let maxHeight = 0;
      const heights = [];

      for (let x = 0; x < COLS; x += 1) {
        let height = 0;
        let found = false;
        for (let y = 0; y < ROWS; y += 1) {
          if (sim[y][x]) {
            if (!found) {
              found = true;
              height = ROWS - y;
            }
          } else if (found) {
            holes += 1;
          }
        }
        heights.push(height);
        aggregate += height;
        if (height > maxHeight) maxHeight = height;
      }

      let bumpiness = 0;
      for (let x = 0; x < COLS - 1; x += 1) {
        bumpiness += Math.abs(heights[x] - heights[x + 1]);
      }

      return (
        -0.51 * aggregate +
        0.76 * cleared -
        0.36 * holes -
        0.18 * bumpiness -
        (maxHeight > 15 ? 3 : 0)
      );
    }

    function bestFor(base) {
      let best = null;
      let m = base.map((row) => row.slice());

      for (let r = 0; r < 4; r += 1) {
        for (let x = -3; x < COLS; x += 1) {
          let y = -m.length;
          if (!fits(m, x, y)) continue;
          while (fits(m, x, y + 1)) y += 1;
          if (y + m.length <= 0) continue;

          const sim = board.map((row) => row.slice());
          let above = false;
          for (let yy = 0; yy < m.length; yy += 1) {
            for (let xx = 0; xx < m.length; xx += 1) {
              if (!m[yy][xx]) continue;
              const by = y + yy;
              const bx = x + xx;
              if (by < 0) above = true;
              else sim[by][bx] = 1;
            }
          }
          if (above) continue;

          const cleared = clearSim(sim);
          const value = evaluate(sim, cleared) + rng() * 0.4;
          if (!best || value > best.value) best = { m, x, value };
        }
        m = rotate(m);
      }

      return best || { m: base, x: 3, value: 0 };
    }

    function spawn() {
      if (!bag.length) {
        bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
        for (let i = bag.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rng() * (i + 1));
          const tmp = bag[i];
          bag[i] = bag[j];
          bag[j] = tmp;
        }
      }

      const kind = bag.pop();
      const def = SHAPES[kind];
      const base = def.m.map((row) => row.slice());
      const plan = bestFor(base);

      piece = { m: plan.m, x: 3, y: 0, c: def.c };
      target = plan;
      if (!fits(piece.m, piece.x, piece.y)) {
        piece.x = clamp(plan.x, 0, COLS - 1);
        if (!fits(piece.m, piece.x, piece.y)) over = true;
      }
    }

    function lock(now) {
      for (let y = 0; y < piece.m.length; y += 1) {
        for (let x = 0; x < piece.m.length; x += 1) {
          if (!piece.m[y][x]) continue;
          const by = piece.y + y;
          const bx = piece.x + x;
          if (by < 0) {
            over = true;
            continue;
          }
          board[by][bx] = piece.c;
        }
      }

      const rows = [];
      for (let y = 0; y < ROWS; y += 1) {
        if (board[y].every((v) => v)) rows.push(y);
      }

      piece = null;

      if (rows.length) {
        score += [0, 100, 300, 500, 800][rows.length] * level;
        lines += rows.length;
        level = 1 + Math.floor(lines / 10);
        clearRows = rows;
        clearUntil = now + 180;
      } else {
        spawn();
      }
    }

    function update(dt, now) {
      if (over) return;

      if (clearRows) {
        if (now >= clearUntil) {
          clearRows.forEach((row) => {
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(0));
          });
          clearRows = null;
          spawn();
        }
        return;
      }

      if (!piece) {
        spawn();
        return;
      }

      moveTimer += dt;
      dropTimer += dt;

      if (piece.x !== target.x) {
        if (moveTimer > 55) {
          moveTimer = 0;
          const dir = target.x > piece.x ? 1 : -1;
          if (fits(piece.m, piece.x + dir, piece.y)) piece.x += dir;
          else target.x = piece.x;
        }
        return;
      }

      const gravity = Math.max(45, 150 - level * 12);
      if (dropTimer >= gravity) {
        dropTimer = 0;
        if (fits(piece.m, piece.x, piece.y + 1)) piece.y += 1;
        else lock(now);
      }
    }

    function draw(p, now) {

      for (let y = 0; y < ROWS; y += 1) {
        if (clearRows && clearRows.indexOf(y) >= 0) continue;
        for (let x = 0; x < COLS; x += 1) {
          const v = board[y][x];
          if (!v) continue;
          ctx.fillStyle = p.pieces[v];
          ctx.fillRect(OX + x * CELL + 1, OY + y * CELL + 1, CELL - 2, CELL - 2);
        }
      }

      if (clearRows && Math.floor(now / 60) % 2 === 0) {
        ctx.fillStyle = p.ink;
        clearRows.forEach((row) => ctx.fillRect(OX, OY + row * CELL, COLS * CELL, CELL));
      }

      if (piece) {
        ctx.fillStyle = p.pieces[piece.c];
        for (let y = 0; y < piece.m.length; y += 1) {
          for (let x = 0; x < piece.m.length; x += 1) {
            if (!piece.m[y][x]) continue;
            ctx.fillRect(
              OX + (piece.x + x) * CELL + 1,
              OY + (piece.y + y) * CELL + 1,
              CELL - 2,
              CELL - 2
            );
          }
        }
      }
    }

    return {
      title: 'TETRIS',
      update,
      draw,
      get board() {
        return board;
      },
      get over() {
        return over;
      },
      get score() {
        return score;
      },
      get level() {
        return level;
      },
    };
  }

  /* ---------------------------------------------------------------- 贪吃蛇 */
  function createSnake(seed) {
    const rng = mulberry32(seed);
    const COLS = 30;
    const ROWS = 20;
    const CELL = 8;
    const OX = 8;
    const OY = 38;
    const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

    let body = [];
    let dir = { x: 1, y: 0 };
    let food = null;
    let score = 0;
    let step = 95;
    let timer = 0;
    let over = false;

    const blockedCell = (x, y) => x < 0 || y < 0 || x >= COLS || y >= ROWS;

    function occupied(x, y, skipTail) {
      for (let i = 0; i < body.length; i += 1) {
        if (skipTail && i === body.length - 1) continue;
        if (body[i].x === x && body[i].y === y) return true;
      }
      return false;
    }

    function placeFood() {
      const free = [];
      for (let y = 0; y < ROWS; y += 1) {
        for (let x = 0; x < COLS; x += 1) {
          if (!occupied(x, y, false)) free.push({ x, y });
        }
      }
      food = free.length ? pick(rng, free) : null;
    }

    function pathTo(from, to) {
      const prev = new Map();
      const seen = new Set([from.y * COLS + from.x]);
      const queue = [from];
      let head = 0;

      while (head < queue.length) {
        const cur = queue[head];
        head += 1;

        if (cur.x === to.x && cur.y === to.y) {
          const path = [cur];
          let key = cur.y * COLS + cur.x;
          while (prev.has(key)) {
            const p = prev.get(key);
            path.push(p);
            key = p.y * COLS + p.x;
          }
          return path.reverse();
        }

        for (let d = 0; d < DIRS.length; d += 1) {
          const nx = cur.x + DIRS[d].x;
          const ny = cur.y + DIRS[d].y;
          if (blockedCell(nx, ny)) continue;
          const key = ny * COLS + nx;
          if (seen.has(key)) continue;
          if (occupied(nx, ny, true)) continue;
          seen.add(key);
          prev.set(key, cur);
          queue.push({ x: nx, y: ny });
        }
      }

      return null;
    }

    function freeArea(start, blocked) {
      const seen = new Set([start.y * COLS + start.x]);
      const stack = [start];
      let count = 0;

      while (stack.length) {
        const cur = stack.pop();
        count += 1;
        for (let d = 0; d < DIRS.length; d += 1) {
          const nx = cur.x + DIRS[d].x;
          const ny = cur.y + DIRS[d].y;
          if (blockedCell(nx, ny)) continue;
          const key = ny * COLS + nx;
          if (seen.has(key) || blocked.has(key)) continue;
          seen.add(key);
          stack.push({ x: nx, y: ny });
        }
      }

      return count;
    }

    function spaceAfter(next, grow) {
      const blocked = new Set();
      const keep = grow ? body.length : body.length - 1;
      for (let i = 0; i < keep; i += 1) blocked.add(body[i].y * COLS + body[i].x);
      return freeArea(next, blocked);
    }

    function choose() {
      const head = body[0];
      let nextStep = null;

      if (food && rng() > 0.05) {
        const path = pathTo(head, food);
        if (path && path.length > 1) {
          const candidate = path[1];
          const grow = candidate.x === food.x && candidate.y === food.y;
          if (spaceAfter(candidate, grow) >= body.length + 3) nextStep = candidate;
        }
      }

      if (!nextStep) {
        let best = null;
        let bestScore = -Infinity;

        for (let d = 0; d < DIRS.length; d += 1) {
          const stepDir = DIRS[d];
          if (stepDir.x === -dir.x && stepDir.y === -dir.y) continue;

          const nx = head.x + stepDir.x;
          const ny = head.y + stepDir.y;
          if (blockedCell(nx, ny)) continue;
          if (occupied(nx, ny, true)) continue;

          const grow = Boolean(food) && nx === food.x && ny === food.y;
          let value = spaceAfter({ x: nx, y: ny }, grow) * 4;
          if (food) value -= Math.abs(nx - food.x) + Math.abs(ny - food.y);
          value += rng() * 3;

          if (value > bestScore) {
            bestScore = value;
            best = { x: nx, y: ny };
          }
        }

        nextStep = best;
      }

      if (!nextStep) return null;
      return { x: nextStep.x - head.x, y: nextStep.y - head.y };
    }

    function reset() {
      body = [];
      for (let i = 0; i < 4; i += 1) body.push({ x: 10 - i, y: 10 });
      dir = { x: 1, y: 0 };
      score = 0;
      step = 95;
      timer = 0;
      over = false;
      placeFood();
    }

    function update(dt) {
      if (over) return;
      timer += dt;
      if (timer < step) return;
      timer = 0;

      const next = choose();
      if (!next) {
        over = true;
        return;
      }

      dir = next;
      const head = body[0];
      const nx = head.x + dir.x;
      const ny = head.y + dir.y;
      if (blockedCell(nx, ny)) {
        over = true;
        return;
      }

      const grow = Boolean(food) && nx === food.x && ny === food.y;
      if (occupied(nx, ny, !grow)) {
        over = true;
        return;
      }

      body.unshift({ x: nx, y: ny });

      if (grow) {
        score += 1;
        if (score % 5 === 0) step = Math.max(55, step - 8);
        placeFood();
      } else {
        body.pop();
      }

      if (!food) over = true;
    }

    function draw(p, now) {

      for (let i = body.length - 1; i >= 0; i -= 1) {
        const seg = body[i];
        ctx.fillStyle = i === 0 ? p.ink : i % 2 === 0 ? p.a : p.a2;
        ctx.fillRect(OX + seg.x * CELL + 1, OY + seg.y * CELL + 1, CELL - 2, CELL - 2);
      }

      /* 眼睛跟着运动方向：朝右就贴在右边，朝上就贴在上边 */
      const head = body[0];
      const hx = OX + head.x * CELL;
      const hy = OY + head.y * CELL;
      ctx.fillStyle = p.bg;
      if (dir.x === 1) {
        ctx.fillRect(hx + 4, hy + 2, 2, 2);
        ctx.fillRect(hx + 4, hy + 5, 2, 2);
      } else if (dir.x === -1) {
        ctx.fillRect(hx + 2, hy + 2, 2, 2);
        ctx.fillRect(hx + 2, hy + 5, 2, 2);
      } else if (dir.y === -1) {
        ctx.fillRect(hx + 2, hy + 2, 2, 2);
        ctx.fillRect(hx + 5, hy + 2, 2, 2);
      } else {
        ctx.fillRect(hx + 2, hy + 5, 2, 2);
        ctx.fillRect(hx + 5, hy + 5, 2, 2);
      }

      if (food && Math.floor(now / 220) % 2 === 0) {
        ctx.fillStyle = p.d;
        ctx.fillRect(OX + food.x * CELL + 1, OY + food.y * CELL + 1, CELL - 2, CELL - 2);
      }
    }

    reset();

    return {
      title: 'SNAKE',
      update,
      draw,
      get dir() {
        return dir;
      },
      get body() {
        return body;
      },
      get over() {
        return over;
      },
      get score() {
        return score;
      },
      get level() {
        return 1;
      },
    };
  }

  /* ---------------------------------------------------------------- 打砖块 */
  function createBreakout(seed) {
    const rng = mulberry32(seed);
    const LEFT = 8;
    const RIGHT = 248;
    const TOP = 44;
    const BOTTOM = 196;
    const CEIL = TOP - 8;
    const COLS = 10;
    const ROWS = 3;
    const BW = 24;
    const BH = 8;

    const paddle = { w: 36, h: 6, x: LEFT + 102, y: BOTTOM - 8 };
    const ball = { x: 0, y: 0, r: 2, dx: 0, dy: 0, speed: 2.5 };

    let bricks = [];
    let level = 1;
    let score = 0;
    let over = false;
    let aimOffset = 0;
    let launchDelay = 0;

    function layout() {
      bricks = [];
      for (let r = 0; r < ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
          if (r > 0 && rng() < 0.05 + level * 0.01) continue;
          bricks.push({
            x: LEFT + c * BW,
            y: TOP + r * BH,
            w: BW - 2,
            h: BH - 2,
            c: (r + Math.floor(rng() * 2)) % 5,
          });
        }
      }
    }

    function resetBall() {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - 10;
      const angle = ((-90 + (rng() * 2 - 1) * 55) * Math.PI) / 180;
      ball.dx = Math.cos(angle) * ball.speed;
      ball.dy = Math.sin(angle) * ball.speed;
      launchDelay = 420;
    }

    function predict() {
      let x = ball.x;
      let y = ball.y;
      let dx = ball.dx;
      const dy = ball.dy;
      if (dy <= 0) return ball.x;

      let guard = 0;
      while (y < paddle.y - 4 && guard < 800) {
        x += dx;
        y += dy;
        if (x < LEFT + 2) {
          x = LEFT + 2;
          dx = Math.abs(dx);
        }
        if (x > RIGHT - 2) {
          x = RIGHT - 2;
          dx = -Math.abs(dx);
        }
        guard += 1;
      }
      return x;
    }

    function hitBricks(prevX, prevY) {
      for (let i = 0; i < bricks.length; i += 1) {
        const brick = bricks[i];
        if (ball.x + ball.r < brick.x || ball.x - ball.r > brick.x + brick.w) continue;
        if (ball.y + ball.r < brick.y || ball.y - ball.r > brick.y + brick.h) continue;

        bricks.splice(i, 1);
        score += 10 * level;

        if (prevY + ball.r <= brick.y) ball.dy = -Math.abs(ball.dy);
        else if (prevY - ball.r >= brick.y + brick.h) ball.dy = Math.abs(ball.dy);
        else if (prevX + ball.r <= brick.x) ball.dx = -Math.abs(ball.dx);
        else ball.dx = Math.abs(ball.dx);

        aimOffset = (rng() * 2 - 1) * 10;
        return;
      }
    }

    function hitPaddle(prevY) {
      if (ball.dy <= 0) return;
      if (ball.y + ball.r < paddle.y) return;
      if (ball.y - ball.r > paddle.y + paddle.h) return;
      if (ball.x + ball.r < paddle.x || ball.x - ball.r > paddle.x + paddle.w) return;
      if (prevY + ball.r > paddle.y + 3) return;

      const rel = clamp((ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
      const angle = rel * 1.02;
      ball.speed = Math.min(4.4, ball.speed + 0.03);
      ball.dx = Math.sin(angle) * ball.speed;
      ball.dy = -Math.abs(Math.cos(angle) * ball.speed);
      ball.y = paddle.y - ball.r;
    }

    function update(dt) {
      if (over) return;
      const k = clamp(dt / 16.667, 0, 2.2);

      let targetX = LEFT + (RIGHT - LEFT) / 2 - paddle.w / 2;
      if (ball.dy > 0 && launchDelay <= 0) targetX = predict() - paddle.w / 2 + aimOffset;
      const maxStep = 4.4 * k;
      paddle.x = clamp(paddle.x + clamp(targetX - paddle.x, -maxStep, maxStep), LEFT, RIGHT - paddle.w);

      if (launchDelay > 0) {
        launchDelay -= dt;
        ball.x = paddle.x + paddle.w / 2;
        ball.y = paddle.y - 10;
        return;
      }

      const steps = Math.max(1, Math.ceil((Math.hypot(ball.dx, ball.dy) * k) / 2));
      for (let s = 0; s < steps; s += 1) {
        const prevX = ball.x;
        const prevY = ball.y;
        ball.x += (ball.dx * k) / steps;
        ball.y += (ball.dy * k) / steps;

        if (ball.x - ball.r < LEFT) {
          ball.x = LEFT + ball.r;
          ball.dx = Math.abs(ball.dx);
        }
        if (ball.x + ball.r > RIGHT) {
          ball.x = RIGHT - ball.r;
          ball.dx = -Math.abs(ball.dx);
        }
        if (ball.y - ball.r < CEIL) {
          ball.y = CEIL + ball.r;
          ball.dy = Math.abs(ball.dy);
        }

        hitBricks(prevX, prevY);
        hitPaddle(prevY);

        if (ball.y - ball.r > BOTTOM) {
          over = true;
          return;
        }
      }

      if (!bricks.length) {
        level += 1;
        score += 200;
        ball.speed = Math.min(4.4, ball.speed + 0.18);
        layout();
        resetBall();
      }
    }

    function draw(p) {
      const palette = [p.b, p.c, p.d, p.e, p.a];

      /* 砖墙面积大，单独压一点透明度，避免背景太抢眼 */
      ctx.globalAlpha = 0.5;
      bricks.forEach((brick) => {
        ctx.fillStyle = palette[brick.c % palette.length];
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      });
      ctx.globalAlpha = 1;

      ctx.fillStyle = p.ink;
      ctx.fillRect(Math.round(paddle.x), paddle.y, paddle.w, paddle.h);
      ctx.fillStyle = p.bg;
      ctx.fillRect(Math.round(paddle.x + paddle.w / 2) - 1, paddle.y + 1, 2, paddle.h - 2);

      ctx.fillStyle = p.ink;
      ctx.fillRect(Math.round(ball.x) - 2, Math.round(ball.y) - 2, 4, 4);
    }

    layout();
    resetBall();

    return {
      title: 'BREAKOUT',
      update,
      draw,
      get over() {
        return over;
      },
      get score() {
        return score;
      },
      get level() {
        return level;
      },
    };
  }

  function createGame(kind, seed) {
    if (kind === 'snake') return createSnake(seed);
    if (kind === 'breakout') return createBreakout(seed);
    return createTetris(seed);
  }

  /* ---------------------------------------------------------------- 流程 */
  function drawHud(p, game) {
    const y = 210;
    drawText(game.title, 8, y, p.dim, 1);
    const tag = Math.floor(performance.now() / 700) % 2 === 0 ? 'CPU' : 'AUTO';
    drawText(tag, 8 + textWidth(game.title, 1) + 6, y, p.a, 1);
    const right = `SCORE ${padScore(game.score)}  LV ${game.level}`;
    drawText(right, W - 8 - textWidth(right, 1), y, p.dim, 1);
  }

  function drawOver(now, p) {
    if (Math.floor(now / 280) % 2 === 0) {
      drawTextCentered('GAME OVER', 96, p.d, 2);
    }
    const score = `SCORE ${padScore(state.game.score)}`;
    drawTextCentered(score, 122, p.ink, 1);
  }

  function startPick(now) {
    state.mode = 'pick';
    state.pickEnd = now + 950;
    state.target = Math.floor(Math.random() * 3);
    state.nextStart = 0;
  }

  function startGame(index) {
    const kind = GAME_KEYS[index];
    state.kind = kind;
    state.game = createGame(kind, (Math.random() * 0xffffffff) >>> 0);
    state.mode = 'play';
    state.selected = index;
    state.target = index;
    state.lastScore = 0;
  }

  function onActivity() {
    const now = performance.now();
    state.lastActivity = now;
    state.nextStart = 0;

    if (forcedIndex >= 0) {
      if (state.mode !== 'play') startGame(forcedIndex);
      return;
    }

    if (state.mode !== 'menu') {
      state.mode = 'menu';
      state.game = null;
      state.selected = 0;
    }
  }

  function update(now, dt) {
    if (state.mode === 'menu') {
      if (remaining(now) <= 0) startPick(now);
      return;
    }

    if (state.mode === 'pick') {
      if (now < state.pickEnd - 220) state.selected = Math.floor(now / 70) % 3;
      if (now >= state.pickEnd) startGame(state.target);
      return;
    }

    if (state.mode === 'play') {
      state.game.update(dt, now);
      state.lastScore = state.game.score;
      if (state.game.over) {
        state.mode = 'over';
        state.overAt = now;
        if (state.game.score > state.hi) {
          state.hi = state.game.score;
          saveHi();
        }
      }
      return;
    }

    if (state.mode === 'over' && now - state.overAt > 1500) {
      state.mode = 'menu';
      state.game = null;
      state.selected = 0;
      state.nextStart = now + 1600;
    }
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H);
    const p = skin();

    if (state.mode === 'menu' || state.mode === 'pick') {
      drawMenu(now);
      return;
    }

    if (!state.game) return;
    state.game.draw(p, now);
    drawHud(p, state.game);
    if (state.mode === 'over') drawOver(now, p);
  }

  let last = performance.now();
  let playingClass = false;

  function tick(now) {
    const dt = Math.min(now - last, 60);
    last = now;
    /* 手机上画布是隐藏的，offsetWidth 为 0，直接跳过省电 */
    if (!document.hidden && canvas.offsetWidth > 0) {
      if (!state.paused) update(now, dt);
      const playing = state.mode === 'play' || state.mode === 'over';
      if (playing !== playingClass) {
        playingClass = playing;
        canvas.classList.toggle('is-playing', playing);
      }
      render(now);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------- 事件 */
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'input'].forEach((type) => {
    window.addEventListener(type, onActivity, { passive: true, capture: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      state.lastActivity = performance.now();
      state.nextStart = 0;
      last = performance.now();
    }
  });

  window.ARCADE = state;

  if (forcedIndex >= 0) startGame(forcedIndex);

  requestAnimationFrame(tick);
})();
