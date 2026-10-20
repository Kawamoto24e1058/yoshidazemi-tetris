import { useCallback } from 'react';
import { db, isFirebaseConfigured } from '../config/firebase';
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  getDocs,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { TIME_LIMIT_SECONDS } from '../config/gameConfig';

export type EndReason = 'timeout' | 'gameover' | 'cleared' | 'disconnected';

export interface PlayerRecord {
  sessionDocId: string;     // 自動生成されたセッションごとの一意なID (FirestoreのドキュメントIDと同一)
  playerId: string;         // 被験者ID (システムが自動採番。個人情報は扱わない)
  group: 'A' | 'B' | 'C';
  playNumber: number;       // 同一プレイヤーIDでの通算プレイ回数 (初回は1)
  status: 'waiting' | 'playing' | 'finished' | 'disconnected';
  score: number;
  linesCleared: number;
  timeLeft: number;
  success: boolean;
  endReason: EndReason | null;
  startTime: any; // Timestamp or Date string
  endTime: any;
  lastActive: any;
  gridJson?: string;        // 盤面グリッドのJSON文字列
  currentPieceJson?: string; // 降下中テトリミノのJSON文字列
}

const MOCK_PLAYERS_KEY = 'tetris_mock_players';

const getMockPlayers = (): PlayerRecord[] => {
  const data = localStorage.getItem(MOCK_PLAYERS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

const saveMockPlayers = (players: PlayerRecord[]) => {
  localStorage.setItem(MOCK_PLAYERS_KEY, JSON.stringify(players));
  window.dispatchEvent(new CustomEvent('mock-db-update'));
};

const toMillis = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return new Date(ts).getTime();
};

// 離脱・ブラウザ終了などで終了処理が走らなかった記録は status が
// 「プレイ中/待機中」のまま残る。プレイ中は1秒ごとに lastActive が更新されるため、
// 一定時間更新がなければ離脱として扱う（表示・CSV用。DBは書き換えない）。
const STALE_AFTER_MS = 3 * 60 * 1000;

export const withEffectiveStatus = (p: PlayerRecord): PlayerRecord => {
  if (p.status !== 'playing' && p.status !== 'waiting') return p;
  const last = toMillis(p.lastActive) || toMillis(p.startTime);
  if (last && Date.now() - last > STALE_AFTER_MS) {
    return { ...p, status: 'disconnected', endReason: p.endReason ?? 'disconnected' };
  }
  return p;
};

export const useFirestore = () => {
  
  // プレイヤーIDの自動発行 (連番 Player001, Player002...)
  const generatePlayerId = useCallback(async (): Promise<string> => {
    if (isFirebaseConfigured) {
      try {
        const counterRef = doc(db, 'counters', 'players');
        const newCount = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists()) {
            transaction.set(counterRef, { count: 1 });
            return 1;
          }
          const nextCount = (counterDoc.data().count || 0) + 1;
          transaction.update(counterRef, { count: nextCount });
          return nextCount;
        });
        
        return `Player${String(newCount).padStart(3, '0')}`;
      } catch (error) {
        console.error('Firebase transaction failed, falling back to mock counter:', error);
      }
    }

    // モックモード
    const MOCK_COUNTER_KEY = 'tetris_mock_counter';
    const currentCountStr = localStorage.getItem(MOCK_COUNTER_KEY) || '0';
    const nextCount = parseInt(currentCountStr, 10) + 1;
    localStorage.setItem(MOCK_COUNTER_KEY, String(nextCount));
    return `Player${String(nextCount).padStart(3, '0')}`;
  }, []);

  // 1.5. 同一プレイヤーIDの過去データ取得 (初回グループの引き継ぎ・通算プレイ回数の算出用)
  // 取得に失敗した場合は「初回プレイ」扱いにせず例外を投げる（グループが再抽選されるのを防ぐ）。
  const getPlayerHistory = useCallback(async (
    playerId: string
  ): Promise<{ group: 'A' | 'B' | 'C' | null; playNumber: number }> => {
    let records: PlayerRecord[];
    if (isFirebaseConfigured) {
      const q = query(collection(db, 'players'), where('playerId', '==', playerId));
      const snapshot = await getDocs(q);
      records = snapshot.docs.map((d) => d.data() as PlayerRecord);
    } else {
      records = getMockPlayers().filter((p) => p.playerId === playerId);
    }

    if (records.length === 0) return { group: null, playNumber: 1 };

    // グループは「最初に割り当てられたもの」を採用 (開始前に離脱した記録も含める)
    records.sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime));
    // プレイ回数は実際にゲームを開始した記録のみ数える (開始ボタン前に離れた「待機中」は除外)
    const startedCount = records.filter((r) => r.status !== 'waiting').length;
    return { group: records[0].group, playNumber: startedCount + 1 };
  }, []);

  // 2. 新規プレイヤーデータの初期登録 (自動生成した sessionDocId を返す)
  const createPlayerRecord = useCallback(async (
    playerId: string,
    group: 'A' | 'B' | 'C',
    playNumber: number
  ): Promise<string> => {

    // Firestoreまたはモック用の自動ドキュメントIDの生成
    let sessionDocId = '';

    if (isFirebaseConfigured) {
      const colRef = collection(db, 'players');
      const docRef = doc(colRef);
      sessionDocId = docRef.id;
    } else {
      sessionDocId = 'mock_' + Math.random().toString(36).substring(2, 11);
    }

    const newRecord: PlayerRecord = {
      sessionDocId,
      playerId,
      group,
      playNumber,
      status: 'waiting',
      score: 0,
      linesCleared: 0,
      timeLeft: TIME_LIMIT_SECONDS,
      success: false,
      endReason: null,
      startTime: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString(),
      endTime: null,
      lastActive: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString(),
    };

    if (isFirebaseConfigured) {
      try {
        await setDoc(doc(db, 'players', sessionDocId), newRecord);
        return sessionDocId;
      } catch (error) {
        console.error('Firestore create failed:', error);
      }
    }

    // モックモード
    const players = getMockPlayers();
    saveMockPlayers([...players, newRecord]);
    return sessionDocId;
  }, []);

  // 2. リアルタイムな進捗同期 (プレイ中)
  const updatePlayerLiveState = useCallback(async (
    sessionDocId: string,
    score: number,
    linesCleared: number,
    timeLeft: number,
    gridJson?: string,
    currentPieceJson?: string
  ) => {
    const updateData: any = {
      score,
      linesCleared,
      timeLeft,
      status: 'playing' as const,
      lastActive: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString(),
    };

    if (gridJson !== undefined) updateData.gridJson = gridJson;
    if (currentPieceJson !== undefined) updateData.currentPieceJson = currentPieceJson;

    if (isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'players', sessionDocId), updateData);
        return;
      } catch (error) {
        console.error('Firestore live update failed:', error);
      }
    }

    // モックモード
    const players = getMockPlayers();
    const index = players.findIndex((p) => p.sessionDocId === sessionDocId);
    if (index !== -1) {
      players[index] = {
        ...players[index],
        ...updateData,
        lastActive: new Date().toISOString(),
      };
      saveMockPlayers(players);
    }
  }, []);

  // 3. ゲーム終了時の最終データ確定
  const finalizePlayerRecord = useCallback(async (
    sessionDocId: string,
    score: number,
    linesCleared: number,
    endReason: EndReason,
    success: boolean
  ) => {
    const finalData = {
      score,
      linesCleared,
      endReason,
      success,
      status: 'finished' as const,
      endTime: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString(),
      lastActive: isFirebaseConfigured ? serverTimestamp() : new Date().toISOString(),
    };

    if (isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'players', sessionDocId), finalData);
        return;
      } catch (error) {
        console.error('Firestore finalization failed:', error);
      }
    }

    // モックモード
    const players = getMockPlayers();
    const index = players.findIndex((p) => p.sessionDocId === sessionDocId);
    if (index !== -1) {
      players[index] = {
        ...players[index],
        ...finalData,
        endTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      saveMockPlayers(players);
    }
  }, []);

  // 4. 離脱ハンドリング (画面を閉じるなど)
  const markAsDisconnected = useCallback(async (sessionDocId: string) => {
    if (isFirebaseConfigured) {
      try {
        await updateDoc(doc(db, 'players', sessionDocId), {
          status: 'disconnected' as const,
          endReason: 'disconnected' as const,
          endTime: serverTimestamp(),
          lastActive: serverTimestamp(),
        });
        return;
      } catch (error) {
        console.error('Firestore disconnect mark failed:', error);
      }
    }

    // モックモード
    const players = getMockPlayers();
    const index = players.findIndex((p) => p.sessionDocId === sessionDocId);
    if (index !== -1 && players[index].status === 'playing') {
      players[index] = {
        ...players[index],
        status: 'disconnected',
        endReason: 'disconnected',
        endTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      };
      saveMockPlayers(players);
    }
  }, []);

  // 5. リアルタイムアクティブプレイヤー監視の購読 (/admin用)
  const subscribeActivePlayers = useCallback((callback: (players: PlayerRecord[]) => void) => {
    if (isFirebaseConfigured) {
      const q = query(
        collection(db, 'players'),
        where('status', '==', 'playing')
      );
      
      return onSnapshot(q, (snapshot) => {
        const activePlayers: PlayerRecord[] = [];
        const now = Date.now();
        snapshot.forEach((doc) => {
          const data = doc.data() as PlayerRecord;
          
          let lastActiveMs = now;
          if (data.lastActive && typeof data.lastActive.toMillis === 'function') {
            lastActiveMs = data.lastActive.toMillis();
          } else if (data.lastActive) {
            lastActiveMs = new Date(data.lastActive).getTime();
          }
          
          // クライアントとサーバーの時刻ズレ（時計の進み/遅れ）を許容するため、絶対値の差分を 5分(300,000ms) 以内とする
          if (Math.abs(now - lastActiveMs) < 300000) {
            activePlayers.push(data);
          }
        });
        callback(activePlayers);
      }, (error) => {
        console.error('Firestore subscribe active players failed:', error);
      });
    }

    // モックモード
    const handleUpdate = () => {
      const allMock = getMockPlayers();
      const now = Date.now();
      const active = allMock.filter((p) => {
        if (p.status !== 'playing') return false;
        const lastActiveMs = new Date(p.lastActive).getTime();
        return Math.abs(now - lastActiveMs) < 300000;
      });
      callback(active);
    };

    handleUpdate();
    window.addEventListener('mock-db-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    const intervalId = setInterval(handleUpdate, 2000);

    return () => {
      window.removeEventListener('mock-db-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(intervalId);
    };
  }, []);

  // 6. 蓄積された全プレイヤーデータの取得 (/admin CSV出力用)
  const fetchAllPlayersData = useCallback(async (): Promise<PlayerRecord[]> => {
    if (isFirebaseConfigured) {
      try {
        const q = query(collection(db, 'players'), orderBy('startTime', 'desc'));
        const snapshot = await getDocs(q);
        const data: PlayerRecord[] = [];
        snapshot.forEach((doc) => {
          data.push(doc.data() as PlayerRecord);
        });
        return data;
      } catch (error) {
        console.error('Firestore fetch all players failed, falling back to mock:', error);
      }
    }

    // モックモード
    return getMockPlayers().sort((a, b) => {
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
  }, []);

  // 7. 個別プレイヤーデータのリアルタイム監視購読 (/admin 詳細表示用 - sessionDocId で引く)
  const subscribeSinglePlayer = useCallback((sessionDocId: string, callback: (player: PlayerRecord | null) => void) => {
    if (isFirebaseConfigured) {
      return onSnapshot(doc(db, 'players', sessionDocId), (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as PlayerRecord);
        } else {
          callback(null);
        }
      }, (error) => {
        console.error(`Firestore subscribe single player (${sessionDocId}) failed:`, error);
      });
    }

    // モックモード
    const handleUpdate = () => {
      const allMock = getMockPlayers();
      const player = allMock.find((p) => p.sessionDocId === sessionDocId) || null;
      callback(player);
    };

    handleUpdate();
    window.addEventListener('mock-db-update', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('mock-db-update', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // モックデータを削除してリセットする機能
  const clearMockData = useCallback(() => {
    localStorage.removeItem(MOCK_PLAYERS_KEY);
    window.dispatchEvent(new CustomEvent('mock-db-update'));
  }, []);

  return {
    generatePlayerId,
    getPlayerHistory,
    createPlayerRecord,
    updatePlayerLiveState,
    finalizePlayerRecord,
    markAsDisconnected,
    subscribeActivePlayers,
    subscribeSinglePlayer,
    fetchAllPlayersData,
    clearMockData,
  };
};
