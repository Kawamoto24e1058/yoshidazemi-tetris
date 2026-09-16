import { useState, useEffect } from 'react';
import { PlayerFlow } from './components/Game/PlayerFlow';
import { AdminLogin } from './components/Admin/AdminLogin';
import { AdminPanel } from './components/Admin/AdminPanel';
import { Lock } from 'lucide-react';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(() => {
    return sessionStorage.getItem('admin_authorized') === 'true';
  });

  // ブラウザの戻る/進む等の履歴ナビゲーションに対応
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // カスタムナビゲーションイベントの検知用
    const handlePushState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('pushstate-change', handlePushState);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('pushstate-change', handlePushState);
    };
  }, []);

  // 管理者ログイン成功ハンドラ
  const handleAdminAuthSuccess = () => {
    setIsAdminAuthorized(true);
    sessionStorage.setItem('admin_authorized', 'true');
  };

  // 管理者ログアウトハンドラ
  const handleAdminLogout = () => {
    setIsAdminAuthorized(false);
    sessionStorage.removeItem('admin_authorized');
    
    // ログアウト時はプレイヤー画面へリダイレクト
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new Event('pushstate-change'));
  };

  // URLを変更するためのヘルパー関数
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new Event('pushstate-change'));
  };

  // 管理者ショートカット: Ctrl(Cmd)+Shift+A でどこからでも管理画面へ
  // (参加者の目に留まる文言なしで、管理者だけが確実に・すぐ辿り着けるようにする)
  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        navigateTo('/admin');
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-[#c5c6c7] relative flex flex-col justify-between">

      {/* メインコンテンツ */}
      <main className="flex-grow flex items-center justify-center">
        {currentPath === '/admin' ? (
          isAdminAuthorized ? (
            <AdminPanel onLogout={handleAdminLogout} />
          ) : (
            <AdminLogin onAuthorized={handleAdminAuthSuccess} />
          )
        ) : (
          <PlayerFlow />
        )}
      </main>

      {/* フッター */}
      <footer className="py-6 border-t border-slate-950 text-center text-xs text-slate-600 bg-slate-950/20">
        <div className="max-w-6xl mx-auto px-4">
          <span>© 2026 吉田ゼミ 実験パズルシステム All Rights Reserved.</span>
        </div>
      </footer>

      {/* 管理者専用の入口。参加者の主目的（プレイ開始）から意識を逸らさないよう、
          文言なし・控えめなアイコンのみにしている。管理者は場所とショートカット
          (Ctrl/Cmd+Shift+A) を知っていれば迷わず・すぐ辿り着ける。 */}
      {currentPath !== '/admin' && (
        <button
          onClick={() => navigateTo('/admin')}
          title="管理者ログイン (Ctrl/Cmd+Shift+A)"
          aria-label="管理者ログイン"
          className="fixed bottom-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-slate-900/40 border border-slate-800/60 text-slate-700 opacity-40 hover:opacity-100 hover:text-cyan-400 hover:border-cyan-800/60 transition-all cursor-pointer"
        >
          <Lock className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default App;
