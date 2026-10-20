import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import { GameScreen } from './GameScreen';
import { ResultScreen } from './ResultScreen';
import { TIME_LIMIT_SECONDS } from '../../config/gameConfig';
import { Play, Sparkles, Settings, Users, Shuffle, RefreshCw, Loader2 } from 'lucide-react';

type FlowState = 'login' | 'game' | 'result';
type Group = 'A' | 'B' | 'C';

// 割り当て済みグループをこのブラウザにも控えておく。
// DB側の記録が取れない/書けなかった場合でも、同じプレイヤーのグループが変わらないようにするため。
const groupMemoryKey = (id: string) => `tetris_group_${id}`;
const readRememberedGroup = (id: string): Group | null => {
  const v = localStorage.getItem(groupMemoryKey(id));
  return v === 'A' || v === 'B' || v === 'C' ? v : null;
};

export const PlayerFlow: React.FC = () => {
  const { generatePlayerId, getPlayerHistory, createPlayerRecord } = useFirestore();

  const [flowState, setFlowState] = useState<FlowState>('login');
  const [playerId, setPlayerId] = useState<string>(() => {
    return localStorage.getItem('tetris_assigned_player_id') || '';
  });
  const [loadingId, setLoadingId] = useState<boolean>(() => {
    return !localStorage.getItem('tetris_assigned_player_id');
  });

  // 二重実行防止ロック用
  const isInitializingRef = useRef(false);

  const [sessionDocId, setSessionDocId] = useState<string>('');
  
  // グループ割り当て方法 ('random' | 'manual')
  const [assignmentType, setAssignmentType] = useState<'random' | 'manual'>('random');
  // 手動選択時のグループ
  const [selectedGroup, setSelectedGroup] = useState<'A' | 'B' | 'C'>('A');
  // 決定された最終グループ
  const [finalGroup, setFinalGroup] = useState<'A' | 'B' | 'C'>('A');

  // 同一プレイヤーIDの過去データ（初回グループの引き継ぎ・通算プレイ回数の表示用）
  const [previousGroup, setPreviousGroup] = useState<'A' | 'B' | 'C' | null>(null);
  const [playNumber, setPlayNumber] = useState<number>(1);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<boolean>(false);
  const [historyReloadKey, setHistoryReloadKey] = useState<number>(0);

  // ゲーム結果の保持
  const [gameResult, setGameResult] = useState<{ score: number; success: boolean } | null>(null);

  // プレイヤーIDの初期取得または生成
  const initPlayerId = useCallback(async (forceNew = false) => {
    const savedId = localStorage.getItem('tetris_assigned_player_id');
    if (savedId && !forceNew) {
      setPlayerId(savedId);
      setLoadingId(false);
      return;
    }

    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setLoadingId(true);
    setPreviousGroup(null);
    setPlayNumber(1);
    setLoadingHistory(true);

    try {
      const newId = await generatePlayerId();
      setPlayerId(newId);
      localStorage.setItem('tetris_assigned_player_id', newId);
    } catch (error) {
      console.error('Failed to generate Player ID:', error);
      const fallbackId = `Player_${Math.floor(100 + Math.random() * 900)}`;
      setPlayerId(fallbackId);
      localStorage.setItem('tetris_assigned_player_id', fallbackId);
    } finally {
      setLoadingId(false);
      isInitializingRef.current = false;
    }
  }, [generatePlayerId]);

  useEffect(() => {
    if (flowState === 'login') {
      const savedId = localStorage.getItem('tetris_assigned_player_id');
      if (!savedId) {
        initPlayerId(false);
      } else {
        setPlayerId(savedId);
        setLoadingId(false);
      }
    }
  }, [flowState, initPlayerId]);

  // ログイン画面が表示されるたび（プレイ終了後に戻ってきた時を含む）に、
  // 過去データ（初回グループ・通算プレイ回数）を取り直す。
  // 取得が終わるまで・失敗した間は開始できないようにし、グループの再抽選を防ぐ。
  useEffect(() => {
    if (flowState !== 'login' || !playerId || loadingId) return;

    let cancelled = false;
    setLoadingHistory(true);
    setHistoryError(false);

    getPlayerHistory(playerId)
      .then((history) => {
        if (cancelled) return;
        const group = history.group ?? readRememberedGroup(playerId);
        setPreviousGroup(group);
        setPlayNumber(history.playNumber);
        if (group) {
          setFinalGroup(group);
        }
        setLoadingHistory(false);
      })
      .catch((error) => {
        console.error('Failed to fetch player history:', error);
        if (cancelled) return;
        setHistoryError(true);
        setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flowState, playerId, loadingId, getPlayerHistory, historyReloadKey]);

  // スタートボタン押下処理
  const handleStartGame = async () => {
    if (!playerId.trim() || loadingHistory || historyError) return;

    // 同一プレイヤーIDの過去プレイがある場合は、初回に割り当てられたグループを引き継ぐ
    let group: 'A' | 'B' | 'C';
    if (previousGroup) {
      group = previousGroup;
    } else if (assignmentType === 'random') {
      const groups: ('A' | 'B' | 'C')[] = ['A', 'B', 'C'];
      group = groups[Math.floor(Math.random() * groups.length)];
    } else {
      group = selectedGroup;
    }

    setFinalGroup(group);
    localStorage.setItem(groupMemoryKey(playerId.trim()), group);

    try {
      // Firestoreに初期プレイヤーデータを登録し、sessionDocId を取得
      const docId = await createPlayerRecord(
        playerId.trim(),
        group,
        playNumber
      );
      setSessionDocId(docId);
      setFlowState('game');
    } catch (error) {
      console.error('Failed to register player record:', error);
      // エラーでもゲームを開始できるよう適当なIDを付与してフォールバック
      setSessionDocId('fallback_' + Date.now());
      setFlowState('game');
    }
  };

  // ゲーム終了時のコールバック
  const handleGameFinished = (score: number, success: boolean) => {
    setGameResult({ score, success });
    setFlowState('result');
  };

  // 再起動 (次のプレイヤー - IDはクリアせず保持)
  const handleRestart = () => {
    setGameResult(null);
    setSessionDocId('');
    setLoadingHistory(true);
    setFlowState('login');
  };

  const startDisabled = !playerId.trim() || loadingId || loadingHistory || historyError;

  return (
    <div className="w-full min-h-[90vh] flex items-center justify-center">
      {flowState === 'login' && (
        <div className="w-full max-w-lg glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-8 animate-fade-in relative overflow-hidden">
          
          {/* 装飾用のネオングロー */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

          {/* ヘッダーロゴ */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 rounded-full text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Academic Experiment System</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mt-1">
              ゼミ実験ゲーム画面
            </h1>
            <p className="text-sm text-slate-400 font-sans max-w-md mx-auto">
              このパズルゲームは、行動データと統計分析を目的とした学術実験用システムです。
            </p>
          </div>

          {/* 割り当て情報カード */}
          <div className="bg-slate-950/60 rounded-2xl border border-slate-900 p-6 space-y-6">
            
            {/* プレイヤーID表示と被験者交代ボタン */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-900">
              <div className="space-y-1">
                <span className="text-sm font-medium text-slate-400">割り当てられたプレイヤーID</span>
                <div className="text-[10px] text-slate-500 font-sans">※一度離れてもこのIDは保持されます。</div>
              </div>
              <div className="flex items-center gap-3">
                {loadingId ? (
                  <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>ID取得中...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xl font-bold font-display text-white tracking-wide">
                      {playerId}
                    </span>
                    <span className="text-[10px] text-cyan-400 font-bold">
                      {loadingHistory ? '確認中...' : `${playNumber}回目のプレイ`}
                    </span>
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => initPlayerId(true)}
                  disabled={loadingId}
                  className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                  title="被験者交代（新しいIDを発行）"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingId ? 'animate-spin' : ''}`} />
                  <span className="text-[10px] font-bold">交代</span>
                </button>
              </div>
            </div>

            {/* 実験グループ割り当てトグル (実験者操作用) */}
            <div className="space-y-4">
              {previousGroup ? (
                <div className="space-y-2">
                  <span className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-slate-500" />
                    条件グループの割り当て方法
                  </span>
                  <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-center text-xs text-cyan-300">
                    このプレイヤーIDは初回プレイ時にグループ{' '}
                    <span className="font-extrabold text-white">{previousGroup}</span>{' '}
                    に割り当てられています。同一プレイヤーのため、今回も同じグループでプレイします。
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-slate-500" />
                      条件グループの割り当て方法
                    </span>

                    {/* トグルスイッチ */}
                    <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setAssignmentType('random')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          assignmentType === 'random'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Shuffle className="w-3 h-3" />
                        ランダム
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentType('manual')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          assignmentType === 'manual'
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        手動指定
                      </button>
                    </div>
                  </div>

                  {/* 手動指定の場合のグループボタン */}
                  {assignmentType === 'manual' ? (
                    <div className="grid grid-cols-3 gap-3 pt-2 animate-slide-down">
                      {(['A', 'B', 'C'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setSelectedGroup(g)}
                          className={`py-3 px-4 rounded-xl border font-bold text-sm transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                            selectedGroup === g
                              ? 'bg-cyan-950/40 border-cyan-500 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <span className="text-[10px] text-slate-500 font-normal uppercase">グループ</span>
                          <span className="text-lg font-extrabold font-display">{g}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-900/30 border border-slate-800/40 rounded-xl text-center text-xs text-slate-500">
                      ゲーム開始時にシステムが自動的にグループ (A/B/C) を均等に割り当てます。
                    </div>
                  )}
                </>
              )}
            </div>

          </div>

          {/* 実験への同意とスタートボタン */}
          <div className="space-y-4">
            {historyError && (
              <div className="p-3 bg-red-950/30 border border-red-900/50 rounded-xl text-center text-xs text-red-300 space-y-2">
                <div>プレイ履歴の確認に失敗しました。通信状況を確認して再試行してください。</div>
                <button
                  type="button"
                  onClick={() => setHistoryReloadKey((k) => k + 1)}
                  className="px-3 py-1 bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 rounded-lg font-bold cursor-pointer"
                >
                  再試行
                </button>
              </div>
            )}
            <button
              onClick={handleStartGame}
              disabled={startDisabled}
              className={`w-full py-4.5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.3)] transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 text-lg ${
                startDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              <Play className="w-5 h-5 fill-current" />
              実験ゲームを開始する
            </button>
            <div className="text-center text-[10px] text-slate-500 leading-relaxed font-sans">
              ※開始ボタンを押すと、{TIME_LIMIT_SECONDS}秒の制限時間付きパズルゲームが始まります。<br />
              キーボード入力（矢印キー、Zキー、Spaceキー）を使用するため、PCでの操作を行ってください。
            </div>
          </div>

        </div>
      )}

      {flowState === 'game' && playerId && sessionDocId && (
        <GameScreen
          playerId={playerId}
          sessionDocId={sessionDocId}
          group={finalGroup}
          playNumber={playNumber}
          onGameFinished={handleGameFinished}
        />
      )}

      {flowState === 'result' && playerId && gameResult && (
        <ResultScreen
          playerId={playerId}
          group={finalGroup}
          playNumber={playNumber}
          score={gameResult.score}
          success={gameResult.success}
          onRestart={handleRestart}
        />
      )}
    </div>
  );
};
