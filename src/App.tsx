import { useState, useEffect } from 'react';
import { PlayerFlow } from './components/Game/PlayerFlow';
import { AdminLogin } from './components/Admin/AdminLogin';
import { AdminPanel } from './components/Admin/AdminPanel';

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

      {/* フッター（実験管理者への控えめな導線付き） */}
      <footer className="py-6 border-t border-slate-950 text-center text-xs text-slate-600 bg-slate-950/20">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>© 2026 吉田ゼミ 実験パズルシステム All Rights Reserved.</span>
          {currentPath !== '/admin' && (
            <button
              onClick={() => navigateTo('/admin')}
              className="text-slate-700 hover:text-cyan-500/80 transition-colors underline cursor-pointer bg-transparent border-none p-0"
            >
              管理者用ログイン
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default App;
