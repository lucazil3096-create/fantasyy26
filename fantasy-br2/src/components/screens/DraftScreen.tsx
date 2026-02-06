'use client';

export default function DraftScreen() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Draft</h2>

      <div className="bg-zinc-800 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">D</span>
        </div>
        <h3 className="text-white font-semibold text-lg mb-2">Sistema de Draft</h3>
        <p className="text-zinc-400 text-sm leading-relaxed">
          O draft sera aberto pelo administrador. Cada usuario escolhe um jogador
          na sua vez, em ordem snake. Fique atento ao timer!
        </p>
      </div>

      {/* Draft Status */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Status</h3>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-zinc-600" />
          <span className="text-zinc-400 text-sm">Draft nao iniciado</span>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Regras</h3>
        <ul className="space-y-2 text-zinc-400 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">1.</span>
            <span>Ordem definida por sorteio</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">2.</span>
            <span>Cada pick tem tempo limite</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">3.</span>
            <span>Se o tempo acabar, auto-pick do melhor disponivel</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">4.</span>
            <span>Ordem snake: 1-2-3...3-2-1...1-2-3</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
