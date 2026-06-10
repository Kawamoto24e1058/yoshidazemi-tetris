import React, { useMemo } from 'react';
import type { Grid, Tetromino } from '../../types/tetris';

interface BoardProps {
  grid: Grid;
  currentPiece: Tetromino;
  gameStarted: boolean;
}

const ROWS = 20;
const COLS = 10;

export const Board: React.FC<BoardProps> = ({ grid, currentPiece, gameStarted }) => {
  // ゴーストピース (落下予測位置) のY座標を計算
  const ghostY = useMemo(() => {
    if (!gameStarted) return 0;

    let yOffset = 0;
    
    // コリジョンチェック関数（簡易版）
    const checkCollisionAtOffset = (yOff: number): boolean => {
      for (let y = 0; y < currentPiece.matrix.length; y++) {
        for (let x = 0; x < currentPiece.matrix[y].length; x++) {
          if (currentPiece.matrix[y][x]) {
            const boardY = currentPiece.position.y + y + yOff;
            const boardX = currentPiece.position.x + x;
            
            if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
              return true;
            }
            if (boardY >= 0 && grid[boardY][boardX] !== '') {
              return true;
            }
          }
        }
      }
      return false;
    };

    while (!checkCollisionAtOffset(yOffset + 1)) {
      yOffset++;
    }

    return currentPiece.position.y + yOffset;
  }, [grid, currentPiece, gameStarted]);

  // グリッドと現在落下中のピース、およびゴーストを合成した二次元配列を生成
  const displayGrid = useMemo(() => {
    // ベースとなる固定済みブロックのコピー
    const tempGrid = grid.map((row) => row.map((cell) => ({ color: cell, isGhost: false, isActive: false })));

    if (!gameStarted) return tempGrid;

    // 1. ゴーストの描画 (アクティブピースより先に描画して重なりを処理)
    for (let y = 0; y < currentPiece.matrix.length; y++) {
      for (let x = 0; x < currentPiece.matrix[y].length; x++) {
        if (currentPiece.matrix[y][x]) {
          const boardY = ghostY + y;
          const boardX = currentPiece.position.x + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            // 固定ブロックがない場合のみ描画
            if (grid[boardY][boardX] === '') {
              tempGrid[boardY][boardX] = {
                color: currentPiece.color,
                isGhost: true,
                isActive: false,
              };
            }
          }
        }
      }
    }

    // 2. アクティブな落下中ピースの描画
    for (let y = 0; y < currentPiece.matrix.length; y++) {
      for (let x = 0; x < currentPiece.matrix[y].length; x++) {
        if (currentPiece.matrix[y][x]) {
          const boardY = currentPiece.position.y + y;
          const boardX = currentPiece.position.x + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            tempGrid[boardY][boardX] = {
              color: currentPiece.color,
              isGhost: false,
              isActive: true,
            };
          }
        }
      }
    }

    return tempGrid;
  }, [grid, currentPiece, ghostY, gameStarted]);

  return (
    <div className="relative p-3 bg-slate-950/80 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md">
      {/* 盤面グリッド */}
      <div className="grid grid-cols-10 gap-[2px] w-[300px] h-[600px] bg-slate-950 rounded-lg overflow-hidden border border-slate-900">
        {displayGrid.map((row, y) =>
          row.map((cell, x) => {
            let cellClass = 'w-full h-full transition-all duration-75 rounded-[3px] ';
            
            if (cell.color !== '') {
              if (cell.isGhost) {
                // ゴーストピースは半透明で枠線のみ、または薄い表示
                cellClass += `${cell.color.split(' ')[0]} opacity-20 border border-white/40`;
              } else {
                // 通常のブロック
                cellClass += `${cell.color} border-t-2 border-l-2`;
              }
            } else {
              // 空セル: 薄いグリッドドットや格子模様
              cellClass += 'bg-slate-900/30 border border-slate-800/10 hover:bg-slate-800/10';
            }

            return (
              <div
                key={`${y}-${x}`}
                className={cellClass}
                style={{
                  boxSizing: 'border-box',
                }}
              />
            );
          })
        )}
      </div>

      {/* グリッド上のグリッド線エフェクト（美観用） */}
      <div className="absolute inset-0 pointer-events-none border border-cyan-500/10 rounded-2xl m-3" />
    </div>
  );
};
