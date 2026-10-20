import { useState, useEffect, useCallback, useRef } from 'react';
import type { Grid, Tetromino, TetrominoType, Point } from '../types/tetris';
import { CLEAR_SCORE, POINTS_PER_LINE, TIME_LIMIT_SECONDS } from '../config/gameConfig';

const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL = 800; // ブロックの落下速度 (すべてのグループで800msに固定)

export type GameEndReason = 'timeout' | 'gameover' | 'cleared';

const SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS: Record<TetrominoType, string> = {
  I: 'bg-cyan-500 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]',
  O: 'bg-yellow-500 border-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.6)]',
  T: 'bg-purple-500 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]',
  S: 'bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
  Z: 'bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
  J: 'bg-blue-500 border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
  L: 'bg-orange-500 border-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.6)]',
};

const LINE_CLEAR_MESSAGES: Record<number, string> = {
  1: 'SINGLE',
  2: 'DOUBLE!',
  3: 'TRIPLE!!',
  4: 'TETRIS!!!',
};

const createEmptyGrid = (): Grid =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(''));

const ALL_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const buildPiece = (type: TetrominoType): Tetromino => {
  const matrix = SHAPES[type];
  const color = COLORS[type];

  const position: Point = {
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === 'I' ? -1 : 0,
  };

  return { type, matrix, position, color };
};

const shuffle = (types: TetrominoType[]): TetrominoType[] => {
  const result = [...types];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// 7種のミノを1袋ずつ均等に出す「7-bag」方式。
// 完全ランダムだと同じミノが連続する可能性があり、実験の「難易度固定」の妨げになるため採用。
// 袋の中身はstateとして持ち、更新関数を純粋に保つ (StrictModeの二重実行でも袋が狂わない)。
const drawFromBag = (bag: TetrominoType[]): { piece: Tetromino; bag: TetrominoType[] } => {
  const source = bag.length > 0 ? bag : shuffle(ALL_TYPES);
  return {
    piece: buildPiece(source[source.length - 1]),
    bag: source.slice(0, -1),
  };
};

const createInitialPieces = () => {
  const first = drawFromBag([]);
  const second = drawFromBag(first.bag);
  return { currentPiece: first.piece, nextPiece: second.piece, bag: second.bag };
};

interface UseTetrisProps {
  onGameEnd: (reason: GameEndReason, finalScore: number, lines: number) => void;
  onStateUpdate?: (score: number, lines: number, timeLeft: number) => void;
}

interface TetrisState {
  grid: Grid;
  currentPiece: Tetromino;
  nextPiece: Tetromino;
  bag: TetrominoType[];
  score: number;
  linesCleared: number;
  gameOver: boolean;
  gameStarted: boolean;
  endReason: GameEndReason | null;
  timeLeft: number;
  actionMessage: string;          // 画面表示用エフェクトメッセージ
  messageTrigger: number;         // エフェクト発火検知用カウンター
}

const createInitialState = (gameStarted: boolean): TetrisState => ({
  grid: createEmptyGrid(),
  ...createInitialPieces(),
  score: 0,
  linesCleared: 0,
  gameOver: false,
  gameStarted,
  endReason: null,
  timeLeft: TIME_LIMIT_SECONDS,
  actionMessage: gameStarted ? 'START!' : '',
  messageTrigger: gameStarted ? Date.now() : 0,
});

export const useTetris = ({ onGameEnd, onStateUpdate }: UseTetrisProps) => {
  const [state, setState] = useState<TetrisState>(() => createInitialState(false));

  const onGameEndRef = useRef(onGameEnd);
  const onStateUpdateRef = useRef(onStateUpdate);

  useEffect(() => {
    onGameEndRef.current = onGameEnd;
    onStateUpdateRef.current = onStateUpdate;
  }, [onGameEnd, onStateUpdate]);

  // コリジョン判定
  const checkCollision = useCallback((piece: Tetromino, currentGrid: Grid, offset: Point = { x: 0, y: 0 }): boolean => {
    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (piece.matrix[y][x]) {
          const nextX = piece.position.x + x + offset.x;
          const nextY = piece.position.y + y + offset.y;

          if (nextX < 0 || nextX >= COLS || nextY >= ROWS) {
            return true;
          }

          if (nextY >= 0 && currentGrid[nextY][nextX] !== '') {
            return true;
          }
        }
      }
    }
    return false;
  }, []);

  // ミノの固定 (着地/ハードドロップ共通)。ライン消去・採点・クリア/ゲームオーバー判定を行う。
  // 得点は「1列消去につき100点」のみ (計画書5-1)。ボーナス加点は設けない。
  const lockPiece = useCallback((prev: TetrisState, piece: Tetromino): TetrisState => {
    const tempGrid = prev.grid.map((row) => [...row]);
    let isTopOut = false;

    for (let y = 0; y < piece.matrix.length; y++) {
      for (let x = 0; x < piece.matrix[y].length; x++) {
        if (piece.matrix[y][x]) {
          const boardY = piece.position.y + y;
          const boardX = piece.position.x + x;

          if (boardY < 0) {
            isTopOut = true;
          } else if (boardY < ROWS && boardX >= 0 && boardX < COLS) {
            tempGrid[boardY][boardX] = piece.color;
          }
        }
      }
    }

    if (isTopOut) {
      return { ...prev, gameOver: true, gameStarted: false, endReason: 'gameover' };
    }

    let cleared = 0;
    const filteredGrid = tempGrid.filter((row) => {
      const isFull = row.every((cell) => cell !== '');
      if (isFull) cleared++;
      return !isFull;
    });

    while (filteredGrid.length < ROWS) {
      filteredGrid.unshift(Array(COLS).fill(''));
    }

    const nextScore = prev.score + cleared * POINTS_PER_LINE;
    const nextLines = prev.linesCleared + cleared;
    const actionMsg = LINE_CLEAR_MESSAGES[cleared] ?? '';
    const messageState = {
      actionMessage: actionMsg || prev.actionMessage,
      messageTrigger: actionMsg ? Date.now() : prev.messageTrigger,
    };

    // 目標点に到達した時点でクリア (残り時間があってもその場で終了)
    if (nextScore >= CLEAR_SCORE) {
      return {
        ...prev,
        grid: filteredGrid,
        score: nextScore,
        linesCleared: nextLines,
        gameOver: true,
        gameStarted: false,
        endReason: 'cleared',
        ...messageState,
      };
    }

    // 初期位置での衝突＝ゲームオーバー
    if (checkCollision(prev.nextPiece, filteredGrid)) {
      return {
        ...prev,
        grid: filteredGrid,
        score: nextScore,
        linesCleared: nextLines,
        gameOver: true,
        gameStarted: false,
        endReason: 'gameover',
      };
    }

    const drawn = drawFromBag(prev.bag);

    return {
      ...prev,
      grid: filteredGrid,
      currentPiece: prev.nextPiece,
      nextPiece: drawn.piece,
      bag: drawn.bag,
      score: nextScore,
      linesCleared: nextLines,
      ...messageState,
    };
  }, [checkCollision]);

  // ゲームの初期化/開始
  const startGame = useCallback(() => {
    setState(createInitialState(true));
  }, []);

  // ミノの回転
  const rotate = useCallback(() => {
    setState((prev) => {
      if (!prev.gameStarted || prev.gameOver) return prev;

      const n = prev.currentPiece.matrix.length;
      const rotatedMatrix = Array.from({ length: n }, (_, r) =>
        Array.from({ length: n }, (_, c) => prev.currentPiece.matrix[n - 1 - c][r])
      );

      const rotatedPiece: Tetromino = {
        ...prev.currentPiece,
        matrix: rotatedMatrix,
      };

      const kicks = [0, -1, 1, -2, 2];
      for (const kick of kicks) {
        const shiftedPiece = {
          ...rotatedPiece,
          position: { ...rotatedPiece.position, x: rotatedPiece.position.x + kick },
        };
        if (!checkCollision(shiftedPiece, prev.grid)) {
          return { ...prev, currentPiece: shiftedPiece };
        }
      }

      return prev;
    });
  }, [checkCollision]);

  // 左移動
  const moveLeft = useCallback(() => {
    setState((prev) => {
      if (!prev.gameStarted || prev.gameOver) return prev;
      const nextPiece = {
        ...prev.currentPiece,
        position: { ...prev.currentPiece.position, x: prev.currentPiece.position.x - 1 },
      };
      return checkCollision(nextPiece, prev.grid) ? prev : { ...prev, currentPiece: nextPiece };
    });
  }, [checkCollision]);

  // 右移動
  const moveRight = useCallback(() => {
    setState((prev) => {
      if (!prev.gameStarted || prev.gameOver) return prev;
      const nextPiece = {
        ...prev.currentPiece,
        position: { ...prev.currentPiece.position, x: prev.currentPiece.position.x + 1 },
      };
      return checkCollision(nextPiece, prev.grid) ? prev : { ...prev, currentPiece: nextPiece };
    });
  }, [checkCollision]);

  // 下移動 (自動落下および「下に落とす」操作)
  const moveDown = useCallback(() => {
    setState((prev) => {
      if (!prev.gameStarted || prev.gameOver) return prev;

      const nextPiece = {
        ...prev.currentPiece,
        position: { ...prev.currentPiece.position, y: prev.currentPiece.position.y + 1 },
      };

      // 衝突＝着地
      if (checkCollision(nextPiece, prev.grid)) {
        return lockPiece(prev, prev.currentPiece);
      }

      return { ...prev, currentPiece: nextPiece };
    });
  }, [checkCollision, lockPiece]);

  // 「より速く下に落とす」(一気に最下段まで落として固定)
  const hardDrop = useCallback(() => {
    setState((prev) => {
      if (!prev.gameStarted || prev.gameOver) return prev;

      let currentY = prev.currentPiece.position.y;
      while (true) {
        const testPiece = {
          ...prev.currentPiece,
          position: { ...prev.currentPiece.position, y: currentY + 1 },
        };
        if (checkCollision(testPiece, prev.grid)) {
          break;
        }
        currentY++;
      }

      return lockPiece(prev, {
        ...prev.currentPiece,
        position: { ...prev.currentPiece.position, y: currentY },
      });
    });
  }, [checkCollision, lockPiece]);

  // 1. 自動落下タイマー
  useEffect(() => {
    if (!state.gameStarted || state.gameOver) return;

    const id = setInterval(() => {
      moveDown();
    }, DROP_INTERVAL);

    return () => clearInterval(id);
  }, [state.gameStarted, state.gameOver, moveDown]);

  // 2. 制限時間タイマー
  useEffect(() => {
    if (!state.gameStarted || state.gameOver) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (!prev.gameStarted || prev.gameOver) return prev;
        if (prev.timeLeft <= 1) {
          return {
            ...prev,
            timeLeft: 0,
            gameOver: true,
            gameStarted: false,
            endReason: 'timeout',
          };
        }
        return {
          ...prev,
          timeLeft: prev.timeLeft - 1,
        };
      });
    }, 1000);

    return () => clearInterval(id);
  }, [state.gameStarted, state.gameOver]);

  // 3. ゲーム終了の副作用検知
  const prevGameOverRef = useRef(false);
  useEffect(() => {
    if (state.gameOver && !prevGameOverRef.current) {
      prevGameOverRef.current = true;
      onGameEndRef.current(state.endReason ?? 'gameover', state.score, state.linesCleared);
    }

    if (!state.gameOver) {
      prevGameOverRef.current = false;
    }
  }, [state.gameOver, state.endReason, state.score, state.linesCleared]);

  // 4. ゲーム中リアルタイム状態更新の副作用検知
  useEffect(() => {
    if (state.gameStarted && !state.gameOver) {
      if (onStateUpdateRef.current) {
        onStateUpdateRef.current(state.score, state.linesCleared, state.timeLeft);
      }
    }
  }, [state.score, state.linesCleared, state.timeLeft, state.gameStarted, state.gameOver]);

  return {
    grid: state.grid,
    currentPiece: state.currentPiece,
    nextPiece: state.nextPiece,
    score: state.score,
    linesCleared: state.linesCleared,
    gameOver: state.gameOver,
    gameStarted: state.gameStarted,
    endReason: state.endReason,
    timeLeft: state.timeLeft,
    actionMessage: state.actionMessage,
    messageTrigger: state.messageTrigger,
    success: state.score >= CLEAR_SCORE,
    startGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    hardDrop,
  };
};
