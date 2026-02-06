'use client';

import { useStore, Screen } from '@/store/useStore';

interface NavItem {
  id: Screen;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Inicio', icon: 'H' },
  { id: 'lineup', label: 'Escalar', icon: 'E' },
  { id: 'draft', label: 'Draft', icon: 'D' },
  { id: 'ranking', label: 'Ranking', icon: 'R' },
  { id: 'trades', label: 'Trocas', icon: 'T' },
];

export default function BottomNav() {
  const { screen, setScreen, user } = useStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
                isActive
                  ? 'text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <span className={`text-lg font-bold ${isActive ? 'text-emerald-400' : ''}`}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
        {user?.isAdmin && (
          <button
            onClick={() => setScreen('admin')}
            className={`flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors ${
              screen === 'admin'
                ? 'text-amber-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <span className={`text-lg font-bold ${screen === 'admin' ? 'text-amber-400' : ''}`}>
              A
            </span>
            <span className="text-[10px] font-medium">Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
}
