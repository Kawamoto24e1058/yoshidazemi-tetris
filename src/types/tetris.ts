export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type BlockState = string; // 空文字 "" は空セル、それ以外はテトリミノの種類に応じた色または名前が入る

export type Grid = BlockState[][];

export interface Point {
  x: number;
  y: number;
}

export interface Tetromino {
  type: TetrominoType;
  matrix: number[][]; // 0: 空, 1: ブロック
  position: Point;
  color: string; // Tailwind CSSクラス名（例: "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]"）
}

export interface GameState {
  grid: Grid;
  currentPiece: Tetromino;
  nextPiece: Tetromino;
  score: number;
  linesCleared: number;
  gameOver: boolean;
  gameStarted: boolean;
  timeLeft: number;
  success: boolean;
}
