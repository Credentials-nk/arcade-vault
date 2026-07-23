import type { Skin } from '@/lib/skins';
import { rgbTriplet } from '@/lib/skins';

const CELL = 20;
const COLS = 30;
const ROWS = 30;
const W = COLS * CELL;
const H = ROWS * CELL;

const BASE_TICK_MS = 160;
const MIN_TICK_MS = 70;
const TICK_STEP_MS = 12;
const POINTS_PER_LEVEL = 50;
const SCORE_PER_FOOD = 10;

export interface SerpentinaCallbacks {
  onScore: (score: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

interface Point {
  x: number;
  y: number;
}

const wrap = (v: number, max: number): number => ((v % max) + max) % max;

// El pulso de la comida cuantiza su alpha a centésimas (ya lo hacía `toFixed(2)`
// antes de esta caché); precalcular las 101 cadenas rgba(...) posibles evita
// reconstruir el template string en cada frame de dibujo.
const ALPHA_STEPS = 101;

const buildFoodAlphaCache = (rgb: string): string[] =>
  Array.from({ length: ALPHA_STEPS }, (_, i) => `rgba(${rgb}, ${(i / 100).toFixed(2)})`);

const KEY_DIRECTIONS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export class SerpentinaEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cb: SerpentinaCallbacks;
  private skin: Skin;
  private foodRgb: string;
  private foodAlphaCache: string[];

  private snake: Point[] = [];
  private direction: Point = { x: 1, y: 0 };
  private pendingDirection: Point = { x: 1, y: 0 };
  private food: Point = { x: 0, y: 0 };

  private score = 0;
  private level = 1;
  private gameState: 'playing' | 'gameover' = 'playing';

  private tickInterval = BASE_TICK_MS;
  private tickAccum = 0;

  private paused = false;
  private rafId = 0;
  private lastTime: number | null = null;

  constructor(canvas: HTMLCanvasElement, cb: SerpentinaCallbacks, skin: Skin) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context from canvas');
    this.ctx = ctx;
    this.cb = cb;
    this.skin = skin;
    this.foodRgb = rgbTriplet(skin.accent);
    this.foodAlphaCache = buildFoodAlphaCache(this.foodRgb);

    window.addEventListener('keydown', this.onKeyDown);

    this.initSnake();
    this.spawnFood();
    this.cb.onScore(0);
    this.cb.onLevel(1);

    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.loop);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.lastTime = null;
      cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  /** Recalcula la paleta de render a partir de una nueva skin, en caliente (sin reiniciar la partida). */
  setSkin(skin: Skin): void {
    this.skin = skin;
    this.foodRgb = rgbTriplet(skin.accent);
    this.foodAlphaCache = buildFoodAlphaCache(this.foodRgb);
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const next = KEY_DIRECTIONS[e.key];
    if (!next) return;
    e.preventDefault();
    if (next.x === -this.direction.x && next.y === -this.direction.y) return;
    this.pendingDirection = next;
  };

  private initSnake(): void {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.snake = [
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
      { x: cx - 3, y: cy },
    ];
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = { x: 1, y: 0 };
  }

  private spawnFood(): void {
    let pos: Point;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (this.snake.some((s) => s.x === pos.x && s.y === pos.y));
    this.food = pos;
  }

  private tick(): void {
    this.direction = this.pendingDirection;
    const head = this.snake[0];
    const newHead: Point = {
      x: wrap(head.x + this.direction.x, COLS),
      y: wrap(head.y + this.direction.y, ROWS),
    };

    if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.gameState = 'gameover';
      this.cb.onGameOver(this.score);
      return;
    }

    this.snake.unshift(newHead);

    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += SCORE_PER_FOOD;
      this.cb.onScore(this.score);

      const newLevel = Math.floor(this.score / POINTS_PER_LEVEL) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.tickInterval = Math.max(MIN_TICK_MS, BASE_TICK_MS - (this.level - 1) * TICK_STEP_MS);
        this.cb.onLevel(this.level);
      }

      this.spawnFood();
    } else {
      this.snake.pop();
    }
  }

  private update(dt: number): void {
    if (this.gameState !== 'playing') return;
    this.tickAccum += dt * 1000;
    while (this.tickAccum >= this.tickInterval && this.gameState === 'playing') {
      this.tickAccum -= this.tickInterval;
      this.tick();
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.skin.bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = this.skin.primary;
    for (const seg of this.snake) {
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    }

    const pulse = 0.7 + Math.sin(performance.now() / 150) * 0.3;
    const alphaIdx = Math.round(pulse * 100);
    ctx.fillStyle = this.foodAlphaCache[alphaIdx];
    ctx.fillRect(this.food.x * CELL + 2, this.food.y * CELL + 2, CELL - 4, CELL - 4);
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
