import type { Skin } from '@/lib/skins';
import { rgbTriplet } from '@/lib/skins';

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const W = COLS * CELL; // 640
const H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const LEVEL_SPEEDUP = 1.15; // +15% de velocidad por nivel
const TURTLE_VISIBLE_S = 3;
const TURTLE_SUBMERGED_S = 1.5;
const TURTLE_CYCLE_S = TURTLE_VISIBLE_S + TURTLE_SUBMERGED_S;

const JUMP_MS = 120;
const ROUND_TIME_BASE_S = 15;
const ROUND_TIME_MIN_S = 8;

// 5 bocas de 2 columnas cada una, separadas por columnas "muro" (0,3,6,9,12,15).
const GOAL_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [4, 5],
  [7, 8],
  [10, 11],
  [13, 14],
];

const rand = (min: number, max: number): number => min + Math.random() * (max - min);
const randInt = (min: number, max: number): number => Math.floor(rand(min, max + 1));

export interface FroggerCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

type Direction = 'up' | 'down' | 'left' | 'right';

interface Lane {
  row: number;
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
  /** Desfase aleatorio (s) del ciclo de inmersión — evita que todas las tortugas se sumerjan en sincronía. */
  phase?: number;
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

// ── Construcción de carriles ─────────────────────────────────────────────────
// Cada carril arranca poblado desde col = -4 hasta COLS + 4: cubre todo el
// ancho visible desde el primer frame (no hay que esperar a que las
// entidades "entren" en cámara) y dos carriles nunca comparten fase porque
// cada uno arranca en un offset aleatorio propio.

function buildRoadLane(row: number, dirSign: 1 | -1, level: number): Lane {
  const speed = rand(1.5, 4) * LEVEL_SPEEDUP ** (level - 1);
  const entities: Entity[] = [];
  let col = randInt(-4, 0);
  while (col < COLS + 4) {
    const isTruck = Math.random() < 0.3;
    const width = isTruck ? randInt(2, 3) : 1;
    entities.push({ col, width, type: isTruck ? 'truck' : 'car' });
    col += width + randInt(2, 4); // hueco de 2–4 celdas: siempre atravesable
  }
  return { row, speed, dir: dirSign, entities };
}

function buildRiverLane(row: number, dirSign: 1 | -1, level: number): Lane {
  const speed = rand(1, 3) * LEVEL_SPEEDUP ** (level - 1);
  const entities: Entity[] = [];
  let col = randInt(-4, 0);
  while (col < COLS + 4) {
    const isTurtle = Math.random() < 0.45;
    const width = isTurtle ? randInt(2, 3) : randInt(2, 4);
    entities.push(
      isTurtle
        ? { col, width, type: 'turtle', submerged: false, phase: rand(0, TURTLE_CYCLE_S) }
        : { col, width, type: 'log' }
    );
    col += width + randInt(1, 3); // hueco de al menos 1 celda
  }
  return { row, speed, dir: dirSign, entities };
}

export class FroggerEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cb: FroggerCallbacks;
  private skin: Skin;
  private skinRgb: string;

  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};

  private frog!: Frog;
  private lanes: Lane[] = [];
  private furthestRow = ROW_START;
  private goalsFilled: boolean[] = [false, false, false, false, false];
  private gameTime = 0;

  private score = 0;
  private lives = 3;
  private level = 1;
  private state: 'playing' | 'gameover' = 'playing';

  private roundTimeMax = ROUND_TIME_BASE_S;
  private roundTime = ROUND_TIME_BASE_S;

  private paused = false;
  private rafId = 0;
  private lastTime: number | null = null;

  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement, cb: FroggerCallbacks, skin: Skin) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context from canvas');
    this.ctx = ctx;
    this.cb = cb;
    this.skin = skin;
    this.skinRgb = rgbTriplet(skin.primary);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.keys[e.code]) this.justPressed[e.code] = true;
      this.keys[e.code] = true;
    };
    this.onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.code] = false;
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    this.resetFrog();
    this.lanes = this.buildLanes(this.level);
    this.roundTimeMax = this.roundTimeMaxFor(this.level);
    this.roundTime = this.roundTimeMax;
    this.cb.onScore(0);
    this.cb.onLives(this.lives);
    this.cb.onLevel(this.level);

    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  /** Recalcula la paleta de render a partir de una nueva skin, en caliente (sin reiniciar la partida). */
  setSkin(skin: Skin): void {
    this.skin = skin;
    this.skinRgb = rgbTriplet(skin.primary);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ── Construcción de estado ──────────────────────────────────────────────────

  /** Construye los 5 carriles de carretera + 6 de río para un nivel dado. */
  private buildLanes(level: number): Lane[] {
    const lanes: Lane[] = [];
    let i = 0;
    for (let row = ROW_ROAD_TOP; row <= ROW_ROAD_BOT; row++, i++) {
      lanes.push(buildRoadLane(row, i % 2 === 0 ? 1 : -1, level));
    }
    i = 0;
    for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++, i++) {
      lanes.push(buildRiverLane(row, i % 2 === 0 ? -1 : 1, level));
    }
    return lanes;
  }

  /** Reposiciona la rana en la fila de inicio, columna central. Usado al arrancar, morir y completar ronda. */
  private resetFrog(): void {
    const col = Math.floor(COLS / 2);
    this.frog = {
      col,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: col,
      targetRow: ROW_START,
    };
    this.furthestRow = ROW_START;
  }

  private roundTimeMaxFor(level: number): number {
    return Math.max(ROUND_TIME_MIN_S, ROUND_TIME_BASE_S - (level - 1));
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private pendingDirection(): Direction | null {
    for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      if (this.justPressed[code]) {
        this.justPressed[code] = false;
        return KEY_DIRECTIONS[code];
      }
    }
    return null;
  }

  private startJump(dir: Direction): void {
    let col = this.frog.col;
    let row = this.frog.row;
    if (dir === 'up') row -= 1;
    else if (dir === 'down') row += 1;
    else if (dir === 'left') col -= 1;
    else col += 1;
    col = Math.max(0, Math.min(COLS - 1, col));
    row = Math.max(ROW_GOALS, Math.min(ROW_START, row));
    if (col === this.frog.col && row === this.frog.row) return; // contra el borde: no-op

    this.frog.animating = true;
    this.frog.animT = 0;
    this.frog.targetCol = col;
    this.frog.targetRow = row;
  }

  // ── Colisiones y soporte (Paso 5) ────────────────────────────────────────────

  private checkRoadCollision(): boolean {
    for (const lane of this.lanes) {
      if (lane.row !== this.frog.row) continue;
      for (const e of lane.entities) {
        if (this.frog.col >= e.col && this.frog.col < e.col + e.width) return true;
      }
    }
    return false;
  }

  private getSupport(): Entity | null {
    for (const lane of this.lanes) {
      if (lane.row !== this.frog.row) continue;
      for (const e of lane.entities) {
        if (this.frog.col >= e.col && this.frog.col < e.col + e.width) {
          if (e.type === 'turtle' && e.submerged) return null;
          return e;
        }
      }
    }
    return null;
  }

  private goalSlotForCol(col: number): number {
    return GOAL_SLOTS.findIndex(([a, b]) => col === a || col === b);
  }

  // ── Resolución de aterrizaje ─────────────────────────────────────────────────

  private resolveLanding(): void {
    const { row } = this.frog;

    if (row === ROW_GOALS) {
      this.resolveGoal();
      return;
    }
    if (row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT && this.checkRoadCollision()) {
      this.killFrog();
      return;
    }
    if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT && !this.getSupport()) {
      this.killFrog();
      return;
    }
    if (row < this.furthestRow) {
      this.furthestRow = row;
      this.score += 10;
      this.cb.onScore(this.score);
    }
  }

  private resolveGoal(): void {
    const slot = this.goalSlotForCol(this.frog.col);
    if (slot === -1 || this.goalsFilled[slot]) {
      this.killFrog();
      return;
    }
    this.goalsFilled[slot] = true;
    this.score += 50 + Math.floor(this.roundTime) * 10;
    this.cb.onScore(this.score);

    if (this.goalsFilled.every(Boolean)) {
      this.score += 200;
      this.cb.onScore(this.score);
      this.completeRound();
    } else {
      this.resetFrog();
    }
  }

  // ── Ronda y muerte (Pasos 6–7) ───────────────────────────────────────────────

  private completeRound(): void {
    this.level++;
    this.cb.onLevel(this.level);
    this.goalsFilled = [false, false, false, false, false];
    this.lanes = this.buildLanes(this.level);
    this.resetFrog();
    this.roundTimeMax = this.roundTimeMaxFor(this.level);
    this.roundTime = this.roundTimeMax;
  }

  private killFrog(): void {
    this.lives--;
    this.cb.onLives(this.lives);
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.cb.onGameOver(this.score);
      return;
    }
    this.resetFrog();
    this.roundTime = this.roundTimeMax;
  }

  /** Lee this.state de forma indirecta: comparaciones repetidas de this.state en
   * el mismo método sufren over-narrowing de TS tras llamadas a otros métodos
   * que sí lo reasignan (killFrog). Este getter evita el falso positivo. */
  private isGameOver(): boolean {
    return this.state === 'gameover';
  }

  // ── Game loop ────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    if (this.isGameOver()) return;

    this.gameTime += dt;

    // 1. mover entidades de cada carril (loop continuo, reintroducción por el lado opuesto)
    for (const lane of this.lanes) {
      for (const e of lane.entities) {
        e.col += lane.speed * lane.dir * dt;
        if (lane.dir === 1 && e.col > COLS) e.col = -e.width;
        else if (lane.dir === -1 && e.col + e.width < 0) e.col = COLS;

        if (e.type === 'turtle') {
          const t = (this.gameTime + (e.phase ?? 0)) % TURTLE_CYCLE_S;
          e.submerged = t >= TURTLE_VISIBLE_S;
        }
      }
    }

    // 2. input / animación de salto
    if (!this.frog.animating) {
      const dir = this.pendingDirection();
      if (dir) this.startJump(dir);
    } else {
      this.frog.animT += dt * 1000;
      if (this.frog.animT >= JUMP_MS) {
        this.frog.animating = false;
        this.frog.col = this.frog.targetCol;
        this.frog.row = this.frog.targetRow;
        this.resolveLanding();
      }
    }

    if (this.isGameOver()) return; // resolveLanding pudo haber terminado la partida

    // 3. soporte en el río mientras la rana descansa (no anima)
    if (!this.frog.animating && this.frog.row >= ROW_RIVER_TOP && this.frog.row <= ROW_RIVER_BOT) {
      const support = this.getSupport();
      if (!support) {
        this.killFrog();
      } else {
        const lane = this.lanes.find((l) => l.row === this.frog.row);
        if (lane) {
          this.frog.col += lane.speed * lane.dir * dt;
          if (this.frog.col < 0 || this.frog.col > COLS - 1) this.killFrog();
        }
      }
    }

    if (this.isGameOver()) return;

    // 4. colisión con vehículos mientras la rana descansa en la carretera
    if (
      !this.frog.animating &&
      this.frog.row >= ROW_ROAD_TOP &&
      this.frog.row <= ROW_ROAD_BOT &&
      this.checkRoadCollision()
    ) {
      this.killFrog();
    }

    if (this.isGameOver()) return;

    // 5. temporizador de ronda
    this.roundTime -= dt;
    if (this.roundTime <= 0) {
      this.roundTime = 0;
      this.killFrog();
    }
  }

  private draw(): void {
    this.drawZoneBackgrounds();
    for (const lane of this.lanes) {
      for (const e of lane.entities) this.drawEntity(lane, e);
    }
    this.drawGoals();
    this.drawFrog();
    this.drawHUD();
  }

  private drawZoneBackgrounds(): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.skin.bg;
    ctx.fillRect(0, 0, W, H);

    const band = (from: number, to: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(0, from * CELL, W, (to - from + 1) * CELL);
    };

    band(ROW_GOALS, ROW_GOALS, this.skin.highlight);
    band(ROW_RIVER_TOP, ROW_RIVER_BOT, this.skin.line);
    band(ROW_SAFE_MID, ROW_SAFE_MID, this.skin.highlight);
    // carretera (ROW_ROAD_TOP..ROW_ROAD_BOT) y fila de inicio quedan en skin.bg puro
  }

  private drawEntity(lane: Lane, e: Entity): void {
    const ctx = this.ctx;
    const x = e.col * CELL;
    const y = lane.row * CELL;
    const w = e.width * CELL;
    const h = CELL;
    const pieces = this.skin.pieces;

    if (e.type === 'car') {
      ctx.fillStyle = pieces[0];
      ctx.fillRect(x + 3, y + 6, w - 6, h - 12);
      ctx.fillStyle = this.skin.bg;
      ctx.beginPath();
      ctx.arc(x + 8, y + h - 6, 4, 0, Math.PI * 2);
      ctx.arc(x + w - 8, y + h - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'truck') {
      ctx.fillStyle = pieces[1];
      ctx.fillRect(x + 2, y + 4, w - 4, h - 8);
      ctx.fillStyle = this.skin.text;
      ctx.fillRect(x + w - CELL + 6, y + 8, CELL - 14, h - 16);
    } else if (e.type === 'log') {
      ctx.fillStyle = pieces[2];
      ctx.fillRect(x + 1, y + 10, w - 2, h - 20);
      ctx.strokeStyle = this.skin.bg;
      ctx.lineWidth = 1;
      for (let lx = x + 6; lx < x + w - 4; lx += 8) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 10);
        ctx.lineTo(lx, y + h - 10);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < e.width; i++) {
        const cx = x + i * CELL + CELL / 2;
        const cy = y + h / 2;
        if (e.submerged) {
          ctx.strokeStyle = `rgba(${this.skinRgb}, 0.35)`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL / 2 - 6, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = pieces[3];
          ctx.beginPath();
          ctx.arc(cx, cy, CELL / 2 - 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  private drawGoals(): void {
    const ctx = this.ctx;
    const y = ROW_GOALS * CELL;
    GOAL_SLOTS.forEach(([a, b], i) => {
      const x = a * CELL;
      const w = (b - a + 1) * CELL;
      ctx.fillStyle = this.goalsFilled[i] ? this.skin.accent : this.skin.highlight;
      ctx.fillRect(x + 2, y + 2, w - 4, CELL - 4);
      ctx.strokeStyle = this.skin.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, w - 4, CELL - 4);
      if (this.goalsFilled[i]) {
        ctx.fillStyle = this.skin.primary;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + CELL / 2, CELL / 2 - 8, CELL / 2 - 10, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private drawFrog(): void {
    const ctx = this.ctx;
    const t = this.frog.animating ? Math.min(this.frog.animT / JUMP_MS, 1) : 0;
    const col = this.frog.animating
      ? this.frog.col + (this.frog.targetCol - this.frog.col) * t
      : this.frog.col;
    const row = this.frog.animating
      ? this.frog.row + (this.frog.targetRow - this.frog.row) * t
      : this.frog.row;
    const x = col * CELL + CELL / 2;
    const y = row * CELL + CELL / 2;

    ctx.fillStyle = this.skin.primary;
    ctx.beginPath();
    ctx.ellipse(x, y, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.frog.animating) {
      ctx.strokeStyle = this.skin.primary;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 14, y);
      ctx.lineTo(x - 20, y + 6);
      ctx.moveTo(x + 14, y);
      ctx.lineTo(x + 20, y + 6);
      ctx.stroke();
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 6, y - 8, 3, 0, Math.PI * 2);
    ctx.arc(x + 6, y - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x - 6, y - 8, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 6, y - 8, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHUD(): void {
    const ctx = this.ctx;
    ctx.font = '15px monospace';

    ctx.textAlign = 'left';
    ctx.fillStyle = this.skin.text;
    ctx.fillText(`SCORE ${this.score}`, 6, 24);

    ctx.textAlign = 'center';
    ctx.fillText(`NIVEL ${this.level}`, W / 2, 24);

    for (let i = 0; i < this.lives; i++) {
      const cx = W - 16 - i * 22;
      ctx.fillStyle = this.skin.primary;
      ctx.beginPath();
      ctx.arc(cx, 16, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const pct = Math.max(0, this.roundTime / this.roundTimeMax);
    ctx.fillStyle = pct > 0.5 ? this.skin.primary : pct > 0.2 ? this.skin.accent : '#ff3b3b';
    ctx.fillRect(0, 0, W * pct, 4);
  }

  private loop = (ts: number): void => {
    if (this.paused) return;
    const dt = this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
}

export const FROGGER_CANVAS_W = W;
export const FROGGER_CANVAS_H = H;
export const FROGGER_ROWS = ROWS;
