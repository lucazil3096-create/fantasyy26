'use client';

import { useStore } from '@/store/useStore';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Navbar() {
  const { nickname, isLoggedIn, isAdmin, appearance, currentLeague, setCurrentLeague } = useStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-900 border-b border-zinc-800">
      <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          {appearance.logoUrl ? (
            <img src={appearance.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: appearance.primaryColor }}
            >
              {appearance.logoText}
            </div>
          )}
          <div className="flex flex-col">
            <span className="font-semibold text-white text-sm leading-tight">
              {currentLeague?.name || appearance.siteName}
            </span>
            {isAdmin && (
              <span className="text-amber-400 text-[9px] font-bold tracking-wider">ADMIN</span>
            )}
          </div>
        </div>

        {isLoggedIn && nickname && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentLeague(null)}
              className="text-zinc-500 text-xs hover:text-zinc-300 transition-colors"
              title="Trocar liga"
            >
              Ligas
            </button>
            <button
              onClick={() => signOut(auth)}
              className="w-8 h-8 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center text-xs text-zinc-300 transition-colors"
              title="Sair"
            >
              {nickname.charAt(0).toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
