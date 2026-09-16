import React, { useState, useEffect } from 'react';
import { useFirestore } from '../../hooks/useFirestore';
import type { PlayerRecord } from '../../hooks/useFirestore';
import { isFirebaseConfigured } from '../../config/firebase';
import { Board } from '../Game/Board';
import type { Tetromino } from '../../types/tetris';
import {
  Users,
  Download,
  RefreshCw,
  Clock,
  Trophy,
  Activity,
  LogOut,
  Database,
  Trash2,
  CheckCircle,
  AlertTriangle,
  PlayCircle,
  X
} from 'lucide-react';

interface AdminPanelProps {
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLogout }) => {
  const {
    subscribeActivePlayers,
    subscribeSinglePlayer,
    fetchAllPlayersData,
    clearMockData
  } = useFirestore();

  const [activeTab, setActiveTab] = useState<'live' | 'data'>('live');
  const [activePlayers, setActivePlayers] = useState<PlayerRecord[]>([]);
  const [historicalData, setHistoricalData] = useState<PlayerRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // リアルタイム画面監視用ステート
  const [selectedSessionDocId, setSelectedSessionDocId] = useState<string | null>(null);
  const [selectedPlayerData, setSelectedPlayerData] = useState<PlayerRecord | null>(null);

  // 1. アクティブプレイヤーのリアルタイム監視購読
  useEffect(() => {
    const unsubscribe = subscribeActivePlayers((players) => {
      setActivePlayers(players);
    });
    return () => unsubscribe();
  }, [subscribeActivePlayers]);

  // 2. 選択された個別プレイヤーの詳細監視購読
  useEffect(() => {
    if (!selectedSessionDocId) {
      setSelectedPlayerData(null);
      return;
    }
    const unsubscribe = subscribeSinglePlayer(selectedSessionDocId, (data) => {
      setSelectedPlayerData(data);
    });
    return () => unsubscribe();
  }, [selectedSessionDocId, subscribeSinglePlayer]);

  // 3. 蓄積データの取得
  const refreshHistoricalData = async () => {
    setLoadingData(true);
    try {
      const data = await fetchAllPlayersData();
      setHistoricalData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'data') {
      refreshHistoricalData();
    }
  }, [activeTab]);

  // 4. CSVダウンロード処理 (Excel文字化け防止BOM付)
  const handleDownloadCSV = () => {
    if (historicalData.length === 0) {
      alert('出力するデータがありません。');
      return;
    }

    const headers = [
      'プレイヤーID',
      '条件グループ',
      'プレイ回数',
      '状態',
      'プレイ開始時刻',
      'プレイ終了時刻',
      '最終スコア',
      '列消去回数',
      'クリア判定',
      '終了理由'
    ];

    const formatTime = (ts: any) => {
      if (!ts) return '';
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString('ja-JP');
      return new Date(ts).toLocaleString('ja-JP');
    };

    const rows = historicalData.map((p) => [
      p.playerId,
      p.group,
      p.playNumber ?? 1,
      p.status === 'playing' ? 'プレイ中' : p.status === 'finished' ? '完了' : p.status === 'disconnected' ? '離脱' : '待機中',
      formatTime(p.startTime),
      formatTime(p.endTime),
      p.score,
      p.linesCleared,
      p.success ? '成功' : '失敗',
      p.endReason === 'timeout' ? '時間切れ' : p.endReason === 'gameover' ? '積み上がり' : p.endReason === 'disconnected' ? '離脱' : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `tetris_experiment_data_${new Date().toLocaleDateString('ja-JP').replace(/\//g, '-')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // モックデータクリア処理
  const handleClearMockData = () => {
    if (confirm('ローカルのデモ用プレイヤーデータをすべて削除しますか？(Firebaseのデータは削除されません)')) {
      clearMockData();
      alert('デモデータを初期化しました。');
      refreshHistoricalData();
    }
  };

  // タイムスタンプ表示用の簡易関数
  const displayTime = (ts: any) => {
    if (!ts) return '-';
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleTimeString('ja-JP');
    return new Date(ts).toLocaleTimeString('ja-JP');
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 font-sans select-none animate-fade-in relative">
      
      {/* 上部ヘッダー */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 glass-panel p-6 rounded-3xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">実験監視ダッシュボード</h1>
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <span>ステータス: {isFirebaseConfigured ? <span className="text-emerald-400 font-bold">● Firebase同期中</span> : <span className="text-amber-400 font-bold">● ローカルモック動作中</span>}</span>
            </p>
          </div>
        </div>

        {/* タブ切り替え ＆ ログアウト */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950/60 p-1 rounded-2xl border border-slate-900 flex">
            <button
              onClick={() => setActiveTab('live')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              リアルタイム監視
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'data'
                  ? 'bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-4 h-4" />
              全データ出力
            </button>
          </div>

          <button
            onClick={onLogout}
            className="p-3 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-all cursor-pointer shadow-sm"
            title="ダッシュボード終了"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* タブ1: リアルタイム監視 */}
      {activeTab === 'live' && (
        <div className="space-y-6">
          
          {/* 統計カウンター */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">現在プレイ中の参加者</span>
                <div className="text-4xl font-extrabold text-white font-display flex items-baseline gap-1">
                  {activePlayers.length}
                  <span className="text-xs text-slate-400 font-normal">名</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Users className="w-6 h-6" />
              </div>
            </div>
            
            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">グループ別稼働数</span>
                <div className="text-sm font-bold text-slate-300 font-display flex gap-3">
                  <span>A: <strong className="text-white text-lg">{activePlayers.filter(p => p.group === 'A').length}</strong></span>
                  <span>B: <strong className="text-white text-lg">{activePlayers.filter(p => p.group === 'B').length}</strong></span>
                  <span>C: <strong className="text-white text-lg">{activePlayers.filter(p => p.group === 'C').length}</strong></span>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl border border-purple-500/20 flex items-center justify-center text-purple-400">
                <PlayCircle className="w-6 h-6" />
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">クリア目安到達 (500点超)</span>
                <div className="text-4xl font-extrabold text-emerald-400 font-display flex items-baseline gap-1">
                  {activePlayers.filter(p => p.score >= 500).length}
                  <span className="text-xs text-slate-400 font-normal">名</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Trophy className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* プレイ中一覧 */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              リアルタイムプレイ状況一覧 (クリックで画面監視)
            </h3>

            {activePlayers.length === 0 ? (
              <div className="py-20 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl font-sans">
                現在プレイ中の被験者はいません。
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activePlayers.map((player) => (
                  <div
                    key={player.sessionDocId}
                    onClick={() => setSelectedSessionDocId(player.sessionDocId)}
                    className="bg-slate-950/80 border border-slate-900 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] p-5 rounded-2xl space-y-4 transition-all hover:scale-[1.01] cursor-pointer"
                  >
                    {/* カード上部 */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-extrabold text-white font-display">
                        {player.playerId}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-bold text-cyan-400">
                          グループ {player.group}
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-800 border border-slate-700/80 rounded-lg text-xs font-bold text-slate-300">
                          {player.playNumber ?? 1}回目
                        </span>
                      </div>
                    </div>

                    {/* スコアと残り時間 */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-900/60">
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 uppercase">スコア</div>
                        <div className="text-xl font-bold font-display text-white">{player.score}</div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-[10px] text-slate-500 uppercase">残り時間</div>
                        <div className={`text-xl font-bold font-display ${player.timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
                          {player.timeLeft}秒
                        </div>
                      </div>
                    </div>

                    {/* クリア目標進捗バー */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>目標進捗 (500点)</span>
                        <span>{Math.min(100, (player.score / 500) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all duration-300 rounded-full"
                          style={{ width: `${Math.min(100, (player.score / 500) * 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 下部ステータス */}
                    <div className="flex justify-between items-center pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        開始 {displayTime(player.startTime)}
                      </span>
                      <span className="text-cyan-500/80 font-bold">
                        ライン {player.linesCleared}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* タブ2: 全データ出力 */}
      {activeTab === 'data' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* コントロールパネル */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-slate-800 text-slate-400 text-xs font-semibold rounded-lg">
                データ蓄積数: {historicalData.length} 件
              </span>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={refreshHistoricalData}
                disabled={loadingData}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 text-sm transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                同期・更新
              </button>
              
              <button
                onClick={handleDownloadCSV}
                disabled={historicalData.length === 0}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.2)] text-sm transition-all cursor-pointer ${
                  historicalData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Download className="w-4 h-4" />
                CSVダウンロード
              </button>

              {!isFirebaseConfigured && (
                <button
                  onClick={handleClearMockData}
                  className="p-2 bg-slate-950 hover:bg-red-950/20 text-slate-500 hover:text-red-400 border border-slate-900 hover:border-red-900 rounded-xl transition-all cursor-pointer"
                  title="デモデータ初期化"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* 一覧テーブル */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-slate-800/80">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead>
                  <tr className="bg-slate-950/60 border-b border-slate-900 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">プレイヤーID</th>
                    <th className="py-4 px-6">条件グループ</th>
                    <th className="py-4 px-6">プレイ回数</th>
                    <th className="py-4 px-6">ステータス</th>
                    <th className="py-4 px-6">最終スコア</th>
                    <th className="py-4 px-6">消去ライン</th>
                    <th className="py-4 px-6">成否</th>
                    <th className="py-4 px-6">終了理由</th>
                    <th className="py-4 px-6">プレイ開始時刻</th>
                    <th className="py-4 px-6">プレイ終了時刻</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-slate-300">
                  {historicalData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-20 text-center text-slate-500">
                        {loadingData ? 'データをロード中...' : '蓄積データがありません。'}
                      </td>
                    </tr>
                  ) : (
                    historicalData.map((p) => (
                      <tr
                        key={p.sessionDocId}
                        onClick={() => setSelectedSessionDocId(p.sessionDocId)}
                        className="hover:bg-slate-900/30 transition-all cursor-pointer"
                        title="クリックして詳細画面監視"
                      >
                        <td className="py-4 px-6 font-bold text-white font-display">{p.playerId}</td>
                        <td className="py-4 px-6">
                          <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 rounded font-bold font-display text-cyan-400">
                            {p.group}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-display text-slate-300">{p.playNumber ?? 1}回目</td>
                        <td className="py-4 px-6">
                          {p.status === 'playing' && (
                            <span className="text-cyan-400 font-bold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                              プレイ中
                            </span>
                          )}
                          {p.status === 'finished' && <span className="text-emerald-400 font-semibold">完了</span>}
                          {p.status === 'disconnected' && <span className="text-red-400/80">離脱</span>}
                          {p.status === 'waiting' && <span className="text-slate-500">待機中</span>}
                        </td>
                        <td className="py-4 px-6 font-bold font-display text-white">{p.score}</td>
                        <td className="py-4 px-6 font-display">{p.linesCleared}</td>
                        <td className="py-4 px-6">
                          {p.success ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              成功
                            </span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              失敗
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-slate-400">
                          {p.endReason === 'timeout' && '時間切れ'}
                          {p.endReason === 'gameover' && '積み上がり'}
                          {p.endReason === 'disconnected' && '離脱'}
                          {!p.endReason && '-'}
                        </td>
                        <td className="py-4 px-6 text-slate-500">
                          {p.startTime ? (p.startTime.seconds ? new Date(p.startTime.seconds * 1000).toLocaleString() : new Date(p.startTime).toLocaleString()) : '-'}
                        </td>
                        <td className="py-4 px-6 text-slate-500">
                          {p.endTime ? (p.endTime.seconds ? new Date(p.endTime.seconds * 1000).toLocaleString() : new Date(p.endTime).toLocaleString()) : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* リアルタイム画面監視モーダル */}
      {selectedSessionDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-4xl bg-slate-900/95 border border-slate-800 p-6 rounded-3xl shadow-2xl flex flex-col md:flex-row gap-8 items-center max-h-[95vh] overflow-y-auto">
            
            {/* 閉じるボタン */}
            <button
              onClick={() => setSelectedSessionDocId(null)}
              className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer border border-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 左側：被験者のライブ情報 */}
            <div className="w-full md:w-64 space-y-5 self-start">
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">監視中のプレイヤー</span>
                <h3 className="text-2xl font-extrabold text-white font-display leading-none">
                  {selectedPlayerData?.playerId || '取得中...'}
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="inline-block px-3 py-1 bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 rounded-lg text-xs font-bold">
                    グループ {selectedPlayerData?.group || '-'}
                  </div>
                  <div className="inline-block px-3 py-1 bg-slate-900/50 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold">
                    {selectedPlayerData?.playNumber ?? 1}回目
                  </div>
                </div>
              </div>

              {/* ステータスバッジ */}
              <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-950 space-y-1">
                <div className="text-[10px] text-slate-500">ステータス</div>
                <div className="text-sm font-bold">
                  {selectedPlayerData?.status === 'playing' ? (
                    <span className="text-cyan-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                      プレイ中
                    </span>
                  ) : selectedPlayerData?.status === 'finished' ? (
                    <span className="text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      完了 ({selectedPlayerData.success ? '成功' : '失敗'})
                    </span>
                  ) : selectedPlayerData?.status === 'disconnected' ? (
                    <span className="text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      離脱
                    </span>
                  ) : (
                    <span className="text-slate-500">待機中</span>
                  )}
                </div>
              </div>

              {/* ライブ数値 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950/30 rounded-xl border border-slate-950">
                  <div className="text-[9px] text-slate-500 uppercase">現在のスコア</div>
                  <div className="text-lg font-bold font-display text-white">
                    {selectedPlayerData?.score ?? 0}
                  </div>
                </div>
                <div className="p-3 bg-slate-950/30 rounded-xl border border-slate-950">
                  <div className="text-[9px] text-slate-500 uppercase">残り時間</div>
                  <div className="text-lg font-bold font-display text-white">
                    {selectedPlayerData?.timeLeft ?? 120}秒
                  </div>
                </div>
              </div>

              {/* 消去ライン */}
              <div className="p-3 bg-slate-950/30 rounded-xl border border-slate-950 flex justify-between items-center text-xs">
                <span className="text-slate-500">ライン消去数:</span>
                <span className="font-bold text-slate-200">{selectedPlayerData?.linesCleared ?? 0} Lines</span>
              </div>

              {/* 操作はできませんという注意書き */}
              <div className="p-3 bg-slate-950/10 border border-slate-950 text-[10px] text-slate-500 leading-relaxed rounded-xl font-sans">
                ※これは被験者のゲーム画面をリアルタイムにミラーリングした表示です。ここからゲームを直接操作することはできません。
              </div>
            </div>

            {/* 右側：復元されたテトリス盤面 */}
            <div className="flex-grow flex items-center justify-center p-4 bg-slate-950/40 rounded-2xl border border-slate-950">
              <div className="scale-[0.8] origin-center">
                {(() => {
                  const restoredGrid = selectedPlayerData?.gridJson
                    ? JSON.parse(selectedPlayerData.gridJson)
                    : Array.from({ length: 20 }, () => Array(10).fill(''));

                  const restoredPiece = selectedPlayerData?.currentPieceJson
                    ? JSON.parse(selectedPlayerData.currentPieceJson)
                    : null;

                  const dummyPiece: Tetromino = {
                    type: 'I',
                    matrix: [[0]],
                    position: { x: 0, y: 0 },
                    color: '',
                  };

                  return (
                    <Board
                      grid={restoredGrid}
                      currentPiece={restoredPiece || dummyPiece}
                      gameStarted={selectedPlayerData?.status === 'playing'}
                    />
                  );
                })()}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
