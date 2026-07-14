const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;

const SPRITESHEET_SRC = '/games/bloque-buster/spritesheet-breakout.png';
const SOUND_BOUNCE_SRC = '/games/bloque-buster/sounds/ball-bounce.mp3';
const SOUND_BREAK_SRC = '/games/bloque-buster/sounds/break-sound.mp3';

export interface ArkanoidCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number, won: boolean) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball extends Rect {
  vx: number;
  vy: number;
}

interface Block extends Rect {
  color: string;
  alive: boolean;
}

interface Explosion extends Rect {
  color: string;
  elapsed: number;
}

interface LevelBlock {
  col: number;
  row: number;
  color: string;
}

interface Level {
  speed: number;
  blocks: LevelBlock[];
}

// ── Niveles ───────────────────────────────────────────────────────────────────

const LEVELS: Level[] = (() => {
  const rowColors1 = ['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green'];
  const rowColors2 = ['gray', 'cyan', 'hotpink', 'yellow', 'magenta', 'green'];
  const rowColors4 = ['cyan', 'magenta', 'green', 'yellow', 'hotpink', 'red'];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? 'yellow' : 'magenta' });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? 'hotpink' : 'cyan' });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

// ── Spritesheet ───────────────────────────────────────────────────────────────

interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const EXPLOSION_DURATION = 150;

const EXPLOSION_FRAMES: Record<string, SpriteFrame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const SPRITES: { paddle: SpriteFrame; ball: SpriteFrame; blocks: Record<string, SpriteFrame> } = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

let ssImg: HTMLCanvasElement | null = null;
let ssLoaded = false;
const ssCallbacks: (() => void)[] = [];

function loadSpritesheet(cb: () => void): void {
  if (ssLoaded) {
    cb();
    return;
  }
  ssCallbacks.push(cb);
  if (ssImg) return;

  const rawImg = new Image();
  rawImg.onload = () => {
    const oc = document.createElement('canvas');
    oc.width = rawImg.width;
    oc.height = rawImg.height;
    const octx = oc.getContext('2d');
    if (!octx) return;
    octx.drawImage(rawImg, 0, 0);
    ssImg = oc;
    ssLoaded = true;
    ssCallbacks.forEach((f) => f());
    ssCallbacks.length = 0;
  };
  rawImg.onerror = () => console.error('Failed to load spritesheet');
  rawImg.src = SPRITESHEET_SRC;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  frame: SpriteFrame,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!ssLoaded || !ssImg) return;
  ctx.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  if (!ssLoaded || !ssImg) return;
  let sp: SpriteFrame | undefined;
  if (name.startsWith('block_')) {
    sp = SPRITES.blocks[name.slice(6)];
  } else if (name === 'paddle') {
    sp = SPRITES.paddle;
  } else if (name === 'ball') {
    sp = SPRITES.ball;
  }
  if (!sp) return;
  ctx.drawImage(ssImg, sp.sx, sp.sy, sp.sw, sp.sh, x, y, w, h);
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class ArkanoidEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly cb: ArkanoidCallbacks;
  private readonly bounceSound: HTMLAudioElement;
  private readonly breakSound: HTMLAudioElement;

  private paddle: Rect = { x: 0, y: 560, w: 81, h: 14 };
  private ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];

  private keys: Record<'ArrowLeft' | 'ArrowRight', boolean> = {
    ArrowLeft: false,
    ArrowRight: false,
  };

  private lives = 3;
  private score = 0;
  private currentLevel = 1;
  private gameState: 'playing' | 'gameover' | 'win' = 'playing';

  private paused = false;
  private destroyed = false;
  private rafId = 0;
  private lastTime: number | null = null;

  constructor(canvas: HTMLCanvasElement, cb: ArkanoidCallbacks) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context from canvas');
    this.ctx = ctx;
    this.canvas = canvas;
    this.cb = cb;

    this.bounceSound = new Audio(SOUND_BOUNCE_SRC);
    this.breakSound = new Audio(SOUND_BREAK_SRC);

    canvas.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    loadSpritesheet(() => {
      if (this.destroyed) return;
      this.initPaddle();
      this.loadLevel(1);
      this.cb.onScore(0);
      this.cb.onLives(this.lives);
      this.rafId = requestAnimationFrame(this.loop);
    });
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) {
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    this.paddle.x = Math.max(0, Math.min(W - this.paddle.w, mouseX - this.paddle.w / 2));
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      this.keys[e.key] = true;
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.keys[e.key] = false;
  };

  private playSound(audio: HTMLAudioElement): void {
    const node = audio.cloneNode() as HTMLAudioElement;
    node.play().catch(() => {});
  }

  private initPaddle(): void {
    this.paddle.x = (W - this.paddle.w) / 2;
  }

  private initBall(): void {
    const speed = LEVELS[this.currentLevel - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private loadLevel(n: number): void {
    this.currentLevel = n;
    const level = LEVELS[n - 1];
    this.blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.initBall();
    this.cb.onLevel(n);
  }

  private collideAABB(block: Block): boolean {
    return (
      this.ball.x < block.x + block.w &&
      this.ball.x + this.ball.w > block.x &&
      this.ball.y < block.y + block.h &&
      this.ball.y + this.ball.h > block.y
    );
  }

  private update(dt: number): void {
    if (this.gameState !== 'playing') return;

    if (this.keys.ArrowLeft) this.paddle.x = Math.max(0, this.paddle.x - PADDLE_SPEED * dt);
    if (this.keys.ArrowRight)
      this.paddle.x = Math.min(W - this.paddle.w, this.paddle.x + PADDLE_SPEED * dt);

    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.x <= 0) {
      this.ball.x = 0;
      this.ball.vx = Math.abs(this.ball.vx);
      this.playSound(this.bounceSound);
    }
    if (this.ball.x + this.ball.w >= W) {
      this.ball.x = W - this.ball.w;
      this.ball.vx = -Math.abs(this.ball.vx);
      this.playSound(this.bounceSound);
    }
    if (this.ball.y <= 0) {
      this.ball.y = 0;
      this.ball.vy = Math.abs(this.ball.vy);
      this.playSound(this.bounceSound);
    }

    if (
      this.ball.vy > 0 &&
      this.ball.x + this.ball.w > this.paddle.x &&
      this.ball.x < this.paddle.x + this.paddle.w &&
      this.ball.y + this.ball.h >= this.paddle.y &&
      this.ball.y + this.ball.h <= this.paddle.y + this.paddle.h + 8
    ) {
      this.ball.y = this.paddle.y - this.ball.h;
      this.ball.vy = -Math.abs(this.ball.vy);
      this.playSound(this.bounceSound);
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += 10;
        this.cb.onScore(this.score);
        this.ball.vy = -this.ball.vy;
        this.playSound(this.breakSound);
        if (this.blocks.every((b) => !b.alive)) {
          if (this.currentLevel < 5) {
            this.loadLevel(this.currentLevel + 1);
          } else {
            this.gameState = 'win';
            this.cb.onGameOver(this.score, true);
          }
        }
        break;
      }
    }

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    if (this.ball.y > H) {
      this.lives--;
      this.cb.onLives(Math.max(0, this.lives));
      if (this.lives <= 0) {
        this.lives = 0;
        this.gameState = 'gameover';
        this.cb.onGameOver(this.score, false);
      } else {
        this.initBall();
      }
    }
  }

  private drawOverlay(message: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, W / 2, H / 2);
  }

  private draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (const block of this.blocks) {
      if (block.alive) drawSprite(ctx, 'block_' + block.color, block.x, block.y, block.w, block.h);
    }

    for (const exp of this.explosions) {
      const frames = EXPLOSION_FRAMES[exp.color];
      if (frames) {
        const frameIndex = Math.min(Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4), 3);
        drawFrame(ctx, frames[frameIndex], exp.x, exp.y, exp.w, exp.h);
      }
    }

    drawSprite(ctx, 'paddle', this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    drawSprite(ctx, 'ball', this.ball.x, this.ball.y, this.ball.w, this.ball.h);

    if (this.gameState === 'playing') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Score: ' + this.score, 10, 10);
      ctx.textAlign = 'center';
      ctx.fillText('Nivel: ' + this.currentLevel, W / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < this.lives; i++) {
        const bx = W - 10 - (this.lives - i) * (ballSize + ballSpacing);
        drawSprite(ctx, 'ball', bx, 10, ballSize, ballSize);
      }
    }

    if (this.gameState === 'gameover') this.drawOverlay('GAME OVER');
    if (this.gameState === 'win') this.drawOverlay('¡Completaste el juego!');
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
