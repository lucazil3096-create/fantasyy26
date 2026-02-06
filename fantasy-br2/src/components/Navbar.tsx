'use client';

import { useStore } from '@/store/useStore';

export default function Navbar() {
  const { user, isLoggedIn } = useStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800">
      <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-white text-sm">
            FB
          </div>
          <span className="font-semibold text-white text-lg">Fantasy BR</span>
        </div>

        {isLoggedIn && user ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">{user.nickname}</span>
            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-300">
              {user.nickname.charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-500">Entrar</div>
        )}
      </div>
    </header>
  );
}
