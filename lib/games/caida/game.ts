// Motor de Caída (Tetris) para Arcade Vault.
// Portado desde references/started-games/03-tetris/game.js: se encapsulan los
// globales de estado en la clase TetrisEngine y se reemplaza la manipulación
// directa del DOM (HUD, overlay, tema) por un bridge de callbacks hacia React.

const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // px por celda en el tablero
const NEXT_BLOCK = 30; // px por celda en el preview
const GRID_LINE = 'rgba(255, 255, 255, 0.06)';

const COLORS: (string | null)[] = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#9e9e9e', // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

type Cell = number; // 0 = vacío; 1–8 = índice de color de pieza
type Board = Cell[][];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export interface TetrisCallbacks {
  onScore: (score: number) => void;
  onLines: (lines: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export class TetrisEngine {
  private ctx: CanvasRenderingContext2D;
  private nextCtx: CanvasRenderingContext2D;
  private cb: TetrisCallbacks;

  private board: Board = [];
  private current!: Piece;
  private next!: Piece;

  private score = 0;
  private lines = 0;
  private level = 1;
  private paused = false;
  private gameOver = false;
  private dropInterval = 1000;
  private dropAccum = 0;

  private rafId = 0;
  private lastTime: number | null = null;

  private readonly onKeyDown: (e: KeyboardEvent) => void;

  constructor(boardCanvas: HTMLCanvasElement, nextCanvas: HTMLCanvasElement, cb: TetrisCallbacks) {
    const ctx = boardCanvas.getContext('2d');
    const nextCtx = nextCanvas.getContext('2d');
    if (!ctx || !nextCtx) throw new Error('Cannot get 2d context from canvas');
    this.ctx = ctx;
    this.nextCtx = nextCtx;
    this.cb = cb;

    this.onKeyDown = (e: KeyboardEvent) => this.handleKey(e);
    window.addEventListener('keydown', this.onKeyDown);

    this.init();
  }

  // La pausa (botón y tecla P) la controla React vía setPaused, para que el HUD
  // nunca se desincronice. El engine solo procesa las teclas de juego.
  setPaused(paused: boolean): void {
    if (this.gameOver) return;
    this.paused = paused;
    if (!paused) {
      this.lastTime = null;
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.paused || this.gameOver) return;
    switch (e.code) {
      case 'ArrowLeft':
        if (!this.collide(this.current.shape, this.current.x - 1, this.current.y)) this.current.x--;
        break;
      case 'ArrowRight':
        if (!this.collide(this.current.shape, this.current.x + 1, this.current.y)) this.current.x++;
        break;
      case 'ArrowDown':
        this.softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        this.tryRotate();
        break;
      case 'Space':
        e.preventDefault();
        this.hardDrop();
        break;
      default:
        break;
    }
  }

  private createBoard(): Board {
    return Array.from({ length: ROWS }, () => new Array<Cell>(COLS).fill(0));
  }

  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }

  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  private tryRotate(): void {
    const rotated = this.rotateCW(this.current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge(): void {
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.board[this.current.y + r][this.current.x + c] = this.current.shape[r][c];
  }

  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<Cell>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
      this.cb.onLines(this.lines);
      this.cb.onScore(this.score);
      this.cb.onLevel(this.level);
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private hardDrop(): void {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.cb.onScore(this.score);
    this.lockPiece();
  }

  private softDrop(): void {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
      this.cb.onScore(this.score);
    } else {
      this.lockPiece();
    }
  }

  private lockPiece(): void {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private spawn(): void {
    this.current = this.next;
    this.next = this.randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.endGame();
    }
    this.drawNext();
  }

  private drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha?: number
  ): void {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    if (!color) return;
    context.globalAlpha = alpha ?? 1;
    context.fillStyle = color;
    context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    // highlight
    context.fillStyle = 'rgba(255,255,255,0.12)';
    context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  private drawGrid(): void {
    this.ctx.strokeStyle = GRID_LINE;
    this.ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      this.ctx.beginPath();
      this.ctx.moveTo(c * BLOCK, 0);
      this.ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      this.ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, r * BLOCK);
      this.ctx.lineTo(COLS * BLOCK, r * BLOCK);
      this.ctx.stroke();
    }
  }

  private draw(): void {
    this.ctx.clearRect(0, 0, COLS * BLOCK, ROWS * BLOCK);
    this.drawGrid();

    // board
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) this.drawBlock(this.ctx, c, r, this.board[r][c], BLOCK);

    // ghost
    const gy = this.ghostY();
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            this.ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            BLOCK,
            0.2
          );

    // current piece
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            this.ctx,
            this.current.x + c,
            this.current.y + r,
            this.current.shape[r][c],
            BLOCK
          );
  }

  private drawNext(): void {
    this.nextCtx.clearRect(0, 0, 4 * NEXT_BLOCK, 4 * NEXT_BLOCK);
    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(this.nextCtx, offX + c, offY + r, shape[r][c], NEXT_BLOCK);
  }

  private endGame(): void {
    this.gameOver = true;
    cancelAnimationFrame(this.rafId);
    this.cb.onGameOver(this.score);
  }

  private init(): void {
    this.board = this.createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.paused = false;
    this.gameOver = false;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.lastTime = null;
    this.next = this.randomPiece();
    this.spawn();
    this.cb.onScore(0);
    this.cb.onLines(0);
    this.cb.onLevel(1);
    cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(this.loop);
  }

  private loop = (ts: number): void => {
    if (this.paused) return;
    const dt = this.lastTime === null ? 0 : Math.min(ts - this.lastTime, 100);
    this.lastTime = ts;

    this.dropAccum += dt;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }

    if (this.gameOver) return;
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };
}
