import React from 'react';
import { Play, AlertCircle, CheckCircle } from 'lucide-react';

interface GameOverlayProps {
  gameStarted: boolean;
  gameOver: boolean;
  score: number;
  timeLeft: number;
  success: boolean;
  onStart: () => void;
  savingData: boolean;
}

export const GameOverlay: React.FC<GameOverlayProps> = ({
  gameStarted,
  gameOver,
  score,
  timeLeft,
  success,
  onStart,
  savingData,
}) => {
  if (gameStarted && !gameOver) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 bg-slate-950/85 backdrop-blur-md rounded-2xl border border-slate-800 transition-all duration-300">
      
      {/* 開始前画面 */}
      {!gameStarted && !gameOver && (
        <div className="text-center space-y-6 max-w-sm">
          <div className="mx-auto w-16 h-16 bg-cyan-500/10 rounded-full flex items-center justify-center border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(69,243,255,0.2)]">
            <Play className="w-8 h-8 translate-x-[2px]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white tracking-wide">テトリス型パズル実験</h3>
            <p className="text-sm text-slate-400 font-sans">
              制限時間は2分（120秒）です。<br />
              500点（5ライン消去相当）以上でクリアとなります。<br />
              ゲーム開始ボタンを押すと即座にスタートします。
            </p>
          </div>
          <button
            onClick={onStart}
            className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 text-lg"
          >
            実験ゲームを開始する
          </button>
        </div>
      )}

      {/* ゲームオーバー / タイムアップ (データ保存中・終了画面移行中) */}
      {gameOver && (
        <div className="text-center space-y-6 max-w-sm">
          <div className="mx-auto">
            {success ? (
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle className="w-9 h-9" />
              </div>
            ) : (
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                <AlertCircle className="w-9 h-9" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-3xl font-extrabold text-white">
              {timeLeft <= 0 ? 'TIME UP!' : 'GAME OVER'}
            </h3>
            <p className="text-slate-400 text-sm">
              {timeLeft <= 0 ? '制限時間（2分）が経過しました。' : 'ブロックが最上部に達しました。'}
            </p>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-1">
            <div className="text-xs text-slate-500 uppercase tracking-wider">最終スコア</div>
            <div className="text-4xl font-extrabold font-display text-white">{score} 点</div>
            <div className="text-xs text-slate-400">
              目標: 500点 / 結果:{' '}
              <span className={success ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                {success ? 'クリア成功' : 'クリア失敗'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              {savingData ? '実験データを保存しています...' : '結果画面へ遷移しています...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
