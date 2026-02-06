'use client';

import { useStore } from '@/store/useStore';

export default function AdminScreen() {
  const { user } = useStore();

  if (!user?.isAdmin) {
    return (
      <div className="bg-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-red-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Painel Admin</h2>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Aparencia</p>
          <p className="text-zinc-500 text-xs mt-1">Logo, cores, fontes</p>
        </button>
        <button className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Draft</p>
          <p className="text-zinc-500 text-xs mt-1">Iniciar/gerenciar</p>
        </button>
        <button className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Jogadores</p>
          <p className="text-zinc-500 text-xs mt-1">Sync API / manual</p>
        </button>
        <button className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Temporada</p>
          <p className="text-zinc-500 text-xs mt-1">Config rodadas</p>
        </button>
        <button className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Usuarios</p>
          <p className="text-zinc-500 text-xs mt-1">Ban/unban</p>
        </button>
        <button className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Pontuacao</p>
          <p className="text-zinc-500 text-xs mt-1">Resultados/conferir</p>
        </button>
      </div>

      {/* Status */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Status do Sistema</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Firebase</span>
            <span className="text-emerald-400">Conectado</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">API-Football</span>
            <span className="text-zinc-500">Verificar</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Admin</span>
            <span className="text-emerald-400">{user.nickname}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
