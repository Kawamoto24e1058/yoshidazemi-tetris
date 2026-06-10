import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Board } from './Board';
import { GameOverlay } from './GameOverlay';
import { useTetris } from '../../hooks/useTetris';
import { useFirestore } from '../../hooks/useFirestore';
import { Clock, Trophy, Award, Keyboard, Flame } from 'lucide-react';
import type { Tetromino } from '../../types/tetris';

interface GameScreenProps {
  playerId: string;
  sessionDocId: string;
  name: string;
  studentId: string;
  group: 'A' | 'B' | 'C';
  onGameFinished: (score: number, success: boolean) => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
  playerId,
  sessionDocId,
  name,
  studentId,
  group,
  onGameFinished,
}) => {
  const {
    updatePlayerLiveState,
    finalizePlayerRecord,
    markAsDisconnected,
  } = useFirestore();

  const [savingData, setSavingData] = useState(false);
  const isFinalizingRef = useRef(false);

  // ゲーム終了コールバック
  const handleGameEnd = useCallback(async (
    reason: 'timeout' | 'gameover',
    finalScore: number,
    lines: number
  ) => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;
    
    setSavingData(true);
    const success = finalScore >= 1000;
    
    try {
      await finalizePlayerRecord(sessionDocId, finalScore, lines, reason, success);
    } catch (e) {
      console.error('Finalize error:', e);
    } finally {
      setSavingData(false);
      // 少し余韻を残して結果画面へ
      setTimeout(() => {
        onGameFinished(finalScore, success);
      }, 1500);
    }
  }, [sessionDocId, finalizePlayerRecord, onGameFinished]);

  // テトリスフックの初期化
  const {
    grid,
    currentPiece,
    nextPiece,
    score,
    linesCleared,
    gameOver,
    gameStarted,
    timeLeft,
    actionMessage,
    messageTrigger,
    success,
    startGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate,
    hardDrop,
  } = useTetris({
    onGameEnd: handleGameEnd,
  });

  // アクションボーナスメッセージ表示用
  const [activeMessage, setActiveMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    if (!messageTrigger || !actionMessage) return;
    setActiveMessage(actionMessage);
    setShowMessage(true);

    const timer = setTimeout(() => {
      setShowMessage(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [messageTrigger, actionMessage]);

  // 盤面データ（グリッドとアクティブミノ）をシリアライズして Firestore へ同期 (スロットリング付)
  const lastWriteTimeRef = useRef<number>(0);
  const pendingUpdateRef = useRef<any>(null);

  useEffect(() => {
    if (!gameStarted || gameOver || isFinalizingRef.current) return;

    const syncBoard = async () => {
      const gridJson = JSON.stringify(grid);
      const currentPieceJson = JSON.stringify(currentPiece);
      
      try {
        await updatePlayerLiveState(
          sessionDocId,
          score,
          linesCleared,
          timeLeft,
          gridJson,
          currentPieceJson
        );
      } catch (e) {
        console.error('Board sync error:', e);
      }
    };

    const now = Date.now();
    // モックモード（Firebaseキー未設定）の場合は即時反映してヌルヌル動かす
    // Firebaseの場合はサーバー負荷・料金抑制のため500msのスロットリングをかける
    const isFirebase = !!import.meta.env.VITE_FIREBASE_API_KEY;
    const throttleLimit = isFirebase ? 500 : 0; 
    
    if (throttleLimit === 0 || now - lastWriteTimeRef.current >= throttleLimit) {
      lastWriteTimeRef.current = now;
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = null;
      }
      syncBoard();
    } else {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
      pendingUpdateRef.current = setTimeout(() => {
        lastWriteTimeRef.current = Date.now();
        syncBoard();
      }, throttleLimit - (now - lastWriteTimeRef.current));
    }

    return () => {
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
    };
  }, [grid, currentPiece, score, linesCleared, timeLeft, gameStarted, gameOver, sessionDocId, updatePlayerLiveState]);

  // 1. キーボード操作のイベント監視
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 矢印キーやスペースによるブラウザスクロールを防止
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowLeft':
          moveLeft();
          break;
        case 'ArrowRight':
          moveRight();
          break;
        case 'ArrowDown':
          moveDown();
          break;
        case 'ArrowUp':
        case 'z':
        case 'Z':
        case 'x':
        case 'X':
          rotate();
          break;
        case ' ': // Space
          hardDrop();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, gameOver, moveLeft, moveRight, moveDown, rotate, hardDrop]);

  // 2. 離脱(ウィンドウ閉じる等)の検知
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (gameStarted && !gameOver && !isFinalizingRef.current) {
        markAsDisconnected(sessionDocId);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionDocId, gameStarted, gameOver, markAsDisconnected]);

  // NEXTピースプレビュー描画用
  const renderNextPiecePreview = (piece: Tetromino) => {
    const matrix = piece.matrix;
    const size = matrix.length;
    
    // 4x4 グリッドにセンタリングして描画
    const startX = Math.floor((4 - size) / 2);
    const startY = Math.floor((4 - size) / 2);
    
    const preview = Array.from({ length: 4 }, () => Array(4).fill(''));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (matrix[y][x]) {
          const py = y + startY;
          const px = x + startX;
          if (py >= 0 && py < 4 && px >= 0 && px < 4) {
            preview[py][px] = piece.color;
          }
        }
      }
    }

    return (
      <div className="grid grid-cols-4 gap-[2px] w-24 h-24 bg-slate-950 p-2 rounded-xl border border-slate-900">
        {preview.map((row, y) =>
          row.map((cell, x) => (
            <div
              key={`next-${y}-${x}`}
              className={`w-full h-full rounded-[2px] transition-all duration-100 ${
                cell ? `${cell.split(' ')[0]} border-t border-l border-white/20 shadow-sm` : 'bg-slate-900/30'
              }`}
            />
          ))
        )}
      </div>
    );
  };

  // スコアが1000点(クリア目標)に到達するまでの進捗(%)
  const progressPercent = Math.min(100, (score / 1000) * 100);

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] py-8 px-4 font-sans select-none">
      
      {/* プレイ画面ヘッダー（プレイヤー情報、タイマー） */}
      <div className="w-full max-w-4xl mb-6 flex flex-col md:flex-row justify-between items-center gap-4 glass-panel p-4 rounded-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-400 font-bold border border-slate-700 text-sm">
            ID: <span className="text-white">{playerId}</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-400 border border-slate-700 text-sm">
            氏名: <span className="text-white font-bold">{name}</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-400 border border-slate-700 text-sm">
            学籍番号: <span className="text-white font-bold">{studentId}</span>
          </div>
          <div className="px-3 py-1.5 bg-cyan-950/40 border border-cyan-800/40 rounded-lg text-cyan-400 font-bold text-sm">
            条件グループ: <span className="text-white font-display text-base font-extrabold">{group}</span>
          </div>
        </div>

        {/* タイムカウントダウン */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/80 rounded-xl border border-slate-800 shadow-inner">
            <Clock className={`w-5 h-5 ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`} />
            <span className={`text-2xl font-extrabold font-display ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
              {timeLeft} <span className="text-xs text-slate-500 font-normal">秒</span>
            </span>
          </div>
        </div>
      </div>

      {/* メインゲームボードエリア */}
      <div className="flex flex-col md:flex-row gap-8 items-start relative">
        
        {/* 左サイドバー: スコアと目標 */}
        <div className="w-full md:w-56 space-y-4">
          
          {/* 現在のスコアとクリア目標 */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wide uppercase">
              <Trophy className="w-4 h-4" />
              <span>スコア実績</span>
            </div>
            
            <div className="space-y-1">
              <div className="text-slate-400 text-xs">現在スコア</div>
              <div className="text-4xl font-extrabold font-display text-white">{score}</div>
            </div>

            <div className="space-y-1">
              <div className="text-slate-400 text-xs">消去ライン数</div>
              <div className="text-xl font-bold font-display text-slate-200">{linesCleared} <span className="text-xs text-slate-500 font-normal">Line</span></div>
            </div>

            {/* 進捗プログレス */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">クリア目標 (1000点)</span>
                <span className={`font-bold ${success ? 'text-emerald-400' : 'text-cyan-400'}`}>
                  {progressPercent.toFixed(0)}%
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                <div
                  className={`h-full transition-all duration-300 rounded-full bg-gradient-to-r ${
                    success ? 'from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'from-cyan-500 to-blue-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* 実験同一条件の固定値明記 (娯楽性排除と条件統一の提示) */}
          <div className="bg-slate-900/30 border border-slate-800/40 p-4 rounded-xl text-[11px] text-slate-500 leading-relaxed">
            <div className="font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-orange-500/80" />
              実験パラメータ設定
            </div>
            落下速度: 800ms / 固定<br />
            操作レスポンス: 最適化 / 固定<br />
            ブロック出現頻度: 均等乱数 / 固定
          </div>

        </div>

        {/* 中央: テトリス盤面本体 (オーバーレイを含む) */}
        <div className="relative">
          <Board grid={grid} currentPiece={currentPiece} gameStarted={gameStarted} />
          
          {/* テクニカルアクションのポップアップ演出 */}
          {showMessage && activeMessage && (
            <div className="absolute top-1/4 inset-x-0 z-30 flex items-center justify-center pointer-events-none animate-bounce">
              <div className="px-6 py-2 bg-slate-950/95 border-2 border-cyan-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.7)] backdrop-blur-md">
                <span className="text-lg md:text-xl font-extrabold font-display text-cyan-400 tracking-wider drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] uppercase">
                  {activeMessage}
                </span>
              </div>
            </div>
          )}
          
          <GameOverlay
            gameStarted={gameStarted}
            gameOver={gameOver}
            score={score}
            timeLeft={timeLeft}
            success={success}
            onStart={startGame}
            savingData={savingData}
          />
        </div>

        {/* 右サイドバー: NEXTピース ＆ 操作方法 */}
        <div className="w-full md:w-56 space-y-4">
          
          {/* NEXTテトリミノ */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col items-center space-y-4">
            <div className="w-full flex items-center gap-2 text-cyan-400 font-bold text-sm tracking-wide uppercase">
              <Award className="w-4 h-4" />
              <span>次のブロック</span>
            </div>
            {gameStarted && !gameOver ? (
              renderNextPiecePreview(nextPiece)
            ) : (
              <div className="w-24 h-24 bg-slate-950/50 rounded-xl border border-slate-900 flex items-center justify-center text-slate-700 text-xs">
                待機中
              </div>
            )}
          </div>

          {/* 操作方法ガイド */}
          <div className="glass-panel p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-wider">
              <Keyboard className="w-4 h-4" />
              <span>操作方法 (PC専用)</span>
            </div>
            
            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">左右移動</span>
                <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono">←</kbd>
                <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono">→</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ソフトドロップ</span>
                <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono">↓</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ブロック回転</span>
                <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono">↑</kbd>
                <span className="text-slate-600">or</span>
                <kbd className="px-2 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono">Z</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ハードドロップ</span>
                <kbd className="px-4 py-0.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-[10px]">Space</kbd>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
