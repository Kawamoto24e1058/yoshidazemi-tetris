import React from 'react';
import { Trophy, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { CLEAR_SCORE } from '../../config/gameConfig';

interface ResultScreenProps {
  playerId: string;
  group: 'A' | 'B' | 'C';
  playNumber: number;
  score: number;
  success: boolean;
  onRestart: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  playerId,
  group,
  playNumber,
  score,
  success,
  onRestart,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-12 px-4 font-sans select-none animate-fade-in">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-8 text-center relative overflow-hidden">
        
        {/* 背景のグローエフェクト */}
        <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full blur-[100px] opacity-20 pointer-events-none ${
          success ? 'bg-emerald-500' : 'bg-red-500'
        }`} />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full blur-[100px] opacity-10 pointer-events-none bg-blue-500" />

        {/* 状態アイコン */}
        <div className="flex justify-center">
          {success ? (
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] animate-bounce">
              <CheckCircle className="w-10 h-10" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.3)] animate-pulse">
              <AlertTriangle className="w-10 h-10" />
            </div>
          )}
        </div>

        {/* テキストメッセージ */}
        <div className="space-y-2">
          <h2 className={`text-4xl font-extrabold tracking-wide ${success ? 'text-emerald-400' : 'text-red-400'}`}>
            {success ? '実験タスク成功' : '実験タスク失敗'}
          </h2>
          <p className="text-sm text-slate-400 font-sans">
            パズル実験が終了しました。ご協力ありがとうございました。
          </p>
        </div>

        {/* スコア・条件詳細 */}
        <div className="bg-slate-950/60 rounded-2xl border border-slate-900 p-5 divide-y divide-slate-900">
          <div className="pb-4 space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">プレイヤーID</span>
            <div className="text-lg font-bold text-white">{playerId}</div>
          </div>
          <div className="py-4 space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">実験条件グループ</span>
            <div className="text-lg font-extrabold text-cyan-400 font-display">{group}</div>
          </div>
          <div className="py-4 space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">通算プレイ回数</span>
            <div className="text-lg font-extrabold text-white font-display">{playNumber}回目</div>
          </div>
          <div className="pt-4 space-y-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">最終スコア実績</span>
            <div className="text-3xl font-extrabold text-white font-display flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              {score} 点
            </div>
            <div className="text-[11px] text-slate-500">
              目標スコア: {CLEAR_SCORE}点
            </div>
          </div>
        </div>

        {/* リスタートボタン (次の被験者用) */}
        <button
          onClick={onRestart}
          className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
        >
          次のプレイヤーの測定へ
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* 注意事項 */}
        <div className="text-[10px] text-slate-500 font-sans">
          ※実験データは自動的に送信・集計されました。そのまま画面を閉じるか、次の指示に従ってください。
        </div>

      </div>
    </div>
  );
};
