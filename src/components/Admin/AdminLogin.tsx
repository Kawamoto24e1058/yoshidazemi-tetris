import React, { useState } from 'react';
import { ShieldAlert, Lock, ArrowRight } from 'lucide-react';

interface AdminLoginProps {
  onAuthorized: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onAuthorized }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 環境変数からパスワード取得。未設定の場合は 'admin123'
    const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
    
    if (password === expectedPassword) {
      setError(false);
      onAuthorized();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-12 px-4 font-sans select-none animate-fade-in">
      <div className="w-full max-w-md glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6">
        
        {/* アイコン */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <ShieldAlert className="w-8 h-8" />
          </div>
        </div>

        {/* テキスト */}
        <div className="text-center space-y-1.5">
          <h2 className="text-2xl font-bold text-white tracking-wide">
            実験者専用 管理画面
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            一般参加者の誤進入を防ぐため、パスワードによる認証を行っています。
          </p>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              管理者用パスワード
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                placeholder="パスワードを入力してください"
                className={`w-full py-3 pl-10 pr-4 bg-slate-950/80 rounded-xl border text-sm text-white focus:outline-none focus:ring-1 transition-all ${
                  error
                    ? 'border-red-500/80 focus:ring-red-500'
                    : 'border-slate-800 focus:border-cyan-500 focus:ring-cyan-500'
                }`}
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                ※ パスワードが一致しません。もう一度お試しください。
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-6 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
          >
            認証して入室する
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[10px] text-slate-500 font-sans">
          デフォルトパスワードは <code>admin123</code> です。<br />
          本番環境では <code>VITE_ADMIN_PASSWORD</code> 環境変数を設定してください。
        </div>

      </div>
    </div>
  );
};
