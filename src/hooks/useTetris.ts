import { useState, useEffect, useCallback, useRef } from 'react';
import type { Grid, Tetromino, TetrominoType, Point } from '../types/tetris';

const COLS = 10;
const ROWS = 20;
const DROP_INTERVAL = 800; // ブロックの落下速度 (すべてのグループで800msに固定)

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

const createEmptyGrid = (): Grid =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(''));

const getRandomPiece = (): Tetromino => {
  const types: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const type = types[Math.floor(Math.random() * types.length)];
  const matrix = SHAPES[type];
  const color = COLORS[type];
  
  const position: Point = {
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: type === 'I' ? -1 : 0,
  };

  return { type, matrix, position, color };
};

interface UseTetrisProps {
  onGameEnd: (reason: 'timeout' | 'gameover', finalScore: number, lines: number) => void;
  onStateUpdate?: (score: number, lines: number, timeLeft: number) => void;
}

interface TetrisState {
  grid: Grid;
  currentPiece: Tetromino;
  nextPiece: Tetromino;
  score: number;
  linesCleared: number;
  gameOver: boolean;
  gameStarted: boolean;
  timeLeft: number;
  comboCount: number;             // COMBO数 (連続ライン消去で増加。初期値: -1)
  lastActionWasRotate: boolean;   // 直前のキー操作が回転だったか (Tスピン用)
  actionMessage: string;          // 画面表示用エフェクトメッセージ
  messageTrigger: number;         // エフェクト発火検知用カウンター
}

export const useTetris = ({ onGameEnd, onStateUpdate }: UseTetrisProps) => {
  const [state, setState] = useState<TetrisState>(() => ({
    grid: createEmptyGrid(),
    currentPiece: getRandomPiece(),
    nextPiece: getRandomPiece(),
    score: 0,
    linesCleared: 0,
    gameOver: false,
    gameStarted: false,
    timeLeft: 60,
    comboCount: -1,
    lastActionWasRotate: false,
    actionMessage: '',
    messageTrigger: 0,
  }));

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

  // T-SPIN判定 (3-Corner Rule)
  const checkTSpin = useCallback((piece: Tetromino, currentGrid: Grid, wasRotate: boolean): boolean => {
    if (piece.type !== 'T' || !wasRotate) return false;

    // Tミノの4つの斜め角
    const corners = [
      { dx: 0, dy: 0 }, // 左上
      { dx: 2, dy: 0 }, // 右上
      { dx: 0, dy: 2 }, // 左下
      { dx: 2, dy: 2 }, // 右下
    ];

    let occupiedCount = 0;
    for (const corner of corners) {
      const x = piece.position.x + corner.dx;
      const y = piece.position.y + corner.dy;

      // 盤面外（壁や底）はブロックがあるとみなす
      if (x < 0 || x >= COLS || y >= ROWS) {
        occupiedCount++;
      } else if (y >= 0 && currentGrid[y][x] !== '') {
        occupiedCount++;
      }
    }

    return occupiedCount >= 3;
  }, []);

  // ゲームの初期化/開始
  const startGame = useCallback(() => {
    const firstPiece = getRandomPiece();
    const secondPiece = getRandomPiece();
    
    setState({
      grid: createEmptyGrid(),
      currentPiece: firstPiece,
      nextPiece: secondPiece,
      score: 0,
      linesCleared: 0,
      gameOver: false,
      gameStarted: true,
      timeLeft: 60,
      comboCount: -1,
      lastActionWasRotate: false,
      actionMessage: 'START!',
      messageTrigger: Date.now(),
    });
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
          return {
            ...prev,
            currentPiece: shiftedPiece,
            lastActionWasRotate: true, // 回転成功
          };
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
      return checkCollision(nextPiece, prev.grid)
        ? prev
        : { ...prev, currentPiece: nextPiece, lastActionWasRotate: false };
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
      return checkCollision(nextPiece, prev.grid)
        ? prev
        : { ...prev, currentPiece: nextPiece, lastActionWasRotate: false };
    });
  }, [checkCollision]);

  // 下移動 (自動落下およびソフトドロップ)
  const moveDown = useCallback(() => {
    setState((prev) => {
      if (!prev.gameStarted || prev.gameOver) return prev;

      const nextPiece = {
        ...prev.currentPiece,
        position: { ...prev.currentPiece.position, y: prev.currentPiece.position.y + 1 },
      };

      // 衝突＝着地
      if (checkCollision(nextPiece, prev.grid)) {
        const tempGrid = prev.grid.map((row) => [...row]);
        let isTopOut = false;

        for (let y = 0; y < prev.currentPiece.matrix.length; y++) {
          for (let x = 0; x < prev.currentPiece.matrix[y].length; x++) {
            if (prev.currentPiece.matrix[y][x]) {
              const boardY = prev.currentPiece.position.y + y;
              const boardX = prev.currentPiece.position.x + x;

              if (boardY < 0) {
                isTopOut = true;
              } else if (boardY < ROWS && boardX >= 0 && boardX < COLS) {
                tempGrid[boardY][boardX] = prev.currentPiece.color;
              }
            }
          }
        }

        if (isTopOut) {
          return {
            ...prev,
            gameOver: true,
            gameStarted: false,
          };
        }

        // T-SPIN判定
        const isTSpin = checkTSpin(prev.currentPiece, prev.grid, prev.lastActionWasRotate);

        // ライン消去判定
        let cleared = 0;
        const filteredGrid = tempGrid.filter((row) => {
          const isFull = row.every((cell) => cell !== '');
          if (isFull) cleared++;
          return !isFull;
        });

        while (filteredGrid.length < ROWS) {
          filteredGrid.unshift(Array(COLS).fill(''));
        }

        // スコア計算 ＆ メッセージ生成
        let addedScore = 0;
        let actionMsg = '';

        if (isTSpin) {
          if (cleared === 0) {
            addedScore = 400;
            actionMsg = 'T-SPIN';
          } else if (cleared === 1) {
            addedScore = 800;
            actionMsg = 'T-SPIN SINGLE';
          } else if (cleared === 2) {
            addedScore = 1200;
            actionMsg = 'T-SPIN DOUBLE!';
          } else if (cleared === 3) {
            addedScore = 1600;
            actionMsg = 'T-SPIN TRIPLE!!';
          }
        } else {
          if (cleared === 1) {
            addedScore = 100;
            actionMsg = 'SINGLE';
          } else if (cleared === 2) {
            addedScore = 300;
            actionMsg = 'DOUBLE!';
          } else if (cleared === 3) {
            addedScore = 500;
            actionMsg = 'TRIPLE!!';
          } else if (cleared === 4) {
            addedScore = 1000;
            actionMsg = 'TETRIS!!!';
          }
        }

        // COMBOの適用
        let nextCombo = prev.comboCount;
        if (cleared > 0) {
          nextCombo++;
          if (nextCombo >= 1) {
            addedScore += nextCombo * 50;
            actionMsg += ` + ${nextCombo} COMBO`;
          }
        } else {
          nextCombo = -1; // ラインを消していないのでコンボリセット
        }

        const nextScore = prev.score + addedScore;
        const nextLines = prev.linesCleared + cleared;

        // 次のピースセット
        const next = prev.nextPiece;
        const upcoming = getRandomPiece();

        // 初期位置での衝突＝ゲームオーバー
        if (checkCollision(next, filteredGrid)) {
          return {
            ...prev,
            grid: filteredGrid,
            score: nextScore,
            linesCleared: nextLines,
            gameOver: true,
            gameStarted: false,
          };
        }

        return {
          ...prev,
          grid: filteredGrid,
          currentPiece: next,
          nextPiece: upcoming,
          score: nextScore,
          linesCleared: nextLines,
          comboCount: nextCombo,
          lastActionWasRotate: false,
          // アクションがあった場合のみメッセージトリガーを更新
          actionMessage: actionMsg || prev.actionMessage,
          messageTrigger: actionMsg ? Date.now() : prev.messageTrigger,
        };
      }

      // 衝突なし
      return {
        ...prev,
        currentPiece: nextPiece,
        lastActionWasRotate: false,
      };
    });
  }, [checkCollision, checkTSpin]);

  // ハードドロップ
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

      const tempGrid = prev.grid.map((row) => [...row]);
      let isTopOut = false;

      for (let y = 0; y < prev.currentPiece.matrix.length; y++) {
        for (let x = 0; x < prev.currentPiece.matrix[y].length; x++) {
          if (prev.currentPiece.matrix[y][x]) {
            const boardY = currentY + y;
            const boardX = prev.currentPiece.position.x + x;

            if (boardY < 0) {
              isTopOut = true;
            } else if (boardY < ROWS && boardX >= 0 && boardX < COLS) {
              tempGrid[boardY][boardX] = prev.currentPiece.color;
            }
          }
        }
      }

      if (isTopOut) {
        return {
          ...prev,
          gameOver: true,
          gameStarted: false,
        };
      }

      // T-SPIN判定 (ハードドロップ直前が回転だったか)
      const isTSpin = checkTSpin(prev.currentPiece, prev.grid, prev.lastActionWasRotate);

      // ライン消去
      let cleared = 0;
      const filteredGrid = tempGrid.filter((row) => {
        const isFull = row.every((cell) => cell !== '');
        if (isFull) cleared++;
        return !isFull;
      });

      while (filteredGrid.length < ROWS) {
        filteredGrid.unshift(Array(COLS).fill(''));
      }

      // スコア計算 ＆ メッセージ生成
      let addedScore = 0;
      let actionMsg = '';

      if (isTSpin) {
        if (cleared === 0) {
          addedScore = 400;
          actionMsg = 'T-SPIN';
        } else if (cleared === 1) {
          addedScore = 800;
          actionMsg = 'T-SPIN SINGLE';
        } else if (cleared === 2) {
          addedScore = 1200;
          actionMsg = 'T-SPIN DOUBLE!';
        } else if (cleared === 3) {
          addedScore = 1600;
          actionMsg = 'T-SPIN TRIPLE!!';
        }
      } else {
        if (cleared === 1) {
          addedScore = 100;
          actionMsg = 'SINGLE';
        } else if (cleared === 2) {
          addedScore = 300;
          actionMsg = 'DOUBLE!';
        } else if (cleared === 3) {
          addedScore = 500;
          actionMsg = 'TRIPLE!!';
        } else if (cleared === 4) {
          addedScore = 1000;
          actionMsg = 'TETRIS!!!';
        }
      }

      // COMBOの適用
      let nextCombo = prev.comboCount;
      if (cleared > 0) {
        nextCombo++;
        if (nextCombo >= 1) {
          addedScore += nextCombo * 50;
          actionMsg += ` + ${nextCombo} COMBO`;
        }
      } else {
        nextCombo = -1;
      }

      const nextScore = prev.score + addedScore;
      const nextLines = prev.linesCleared + cleared;

      const next = prev.nextPiece;
      const upcoming = getRandomPiece();

      if (checkCollision(next, filteredGrid)) {
        return {
          ...prev,
          grid: filteredGrid,
          score: nextScore,
          linesCleared: nextLines,
          gameOver: true,
          gameStarted: false,
        };
      }

      return {
        ...prev,
        grid: filteredGrid,
        currentPiece: next,
        nextPiece: upcoming,
        score: nextScore,
        linesCleared: nextLines,
        comboCount: nextCombo,
        lastActionWasRotate: false,
        actionMessage: actionMsg || prev.actionMessage,
        messageTrigger: actionMsg ? Date.now() : prev.messageTrigger,
      };
    });
  }, [checkCollision, checkTSpin]);

  // 1. 自動落下タイマー
  useEffect(() => {
    if (!state.gameStarted || state.gameOver) return;

    const id = setInterval(() => {
      moveDown();
    }, DROP_INTERVAL);

    return () => clearInterval(id);
  }, [state.gameStarted, state.gameOver, moveDown]);

  // 2. 60秒制限時間タイマー
  useEffect(() => {
    if (!state.gameStarted || state.gameOver) return;

    const id = setInterval(() => {
      setState((prev) => {
        if (prev.timeLeft <= 1) {
          clearInterval(id);
          return {
            ...prev,
            timeLeft: 0,
            gameOver: true,
            gameStarted: false,
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
      const reason = state.timeLeft <= 0 ? 'timeout' : 'gameover';
      onGameEndRef.current(reason, state.score, state.linesCleared);
    }
    
    if (!state.gameOver) {
      prevGameOverRef.current = false;
    }
  }, [state.gameOver, state.timeLeft, state.score, state.linesCleared]);

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
    timeLeft: state.timeLeft,
    actionMessage: state.actionMessage,
    messageTrigger: state.messageTrigger,
    success: state.score >= 1000,
    startGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    hardDrop,
  };
};
