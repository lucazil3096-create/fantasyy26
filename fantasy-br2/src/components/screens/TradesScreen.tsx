'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, push, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore, Player, TradeOffer } from '@/store/useStore';

export default function TradesScreen() {
  const { user, trades, setTrades } = useStore();
  const [tab, setTab] = useState<'received' | 'sent' | 'new'>('received');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [targetUser, setTargetUser] = useState('');
  const [targetTeam, setTargetTeam] = useState<Player[]>([]);
  const [offeredIds, setOfferedIds] = useState<Set<number>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  // Listen to trades
  useEffect(() => {
    if (!user) return;
    const tradesRef = ref(db, 'trades');
    const unsub = onValue(tradesRef, (snap) => {
      const data = snap.val();
      if (!data) { setTrades([]); return; }
      const all: TradeOffer[] = Object.entries(data).map(([id, val]) => ({
        ...(val as TradeOffer),
        id,
      }));
      setTrades(all);
    });
    return () => unsub();
  }, [user, setTrades]);

  // Load all users
  useEffect(() => {
    async function load() {
      const snap = await get(ref(db, 'users'));
      const data = snap.val();
      if (data) {
        setAllUsers(Object.keys(data).filter(n => n !== user?.nickname));
      }
    }
    load();
  }, [user?.nickname]);

  // Load target user's team
  useEffect(() => {
    if (!targetUser) { setTargetTeam([]); return; }
    async function load() {
      const snap = await get(ref(db, `users/${targetUser}/team`));
      const data = snap.val();
      setTargetTeam(Array.isArray(data) ? data : []);
    }
    load();
  }, [targetUser]);

  if (!user) return null;

  const myTeam = user.team || [];
  const receivedTrades = trades.filter(t => t.to === user.nickname && t.status === 'pending');
  const sentTrades = trades.filter(t => t.from === user.nickname && t.status === 'pending');

  function toggleOffered(id: number) {
    const s = new Set(offeredIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setOfferedIds(s);
  }

  function toggleRequested(id: number) {
    const s = new Set(requestedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setRequestedIds(s);
  }

  async function sendTrade() {
    if (!targetUser || offeredIds.size === 0 || requestedIds.size === 0) {
      setMsg('Selecione pelo menos 1 jogador de cada lado');
      return;
    }
    setSending(true);
    setMsg('');
    try {
      const offer: Omit<TradeOffer, 'id'> = {
        from: user!.nickname,
        to: targetUser,
        offeredPlayers: myTeam.filter(p => offeredIds.has(p.id)),
        requestedPlayers: targetTeam.filter(p => requestedIds.has(p.id)),
        status: 'pending',
        createdAt: Date.now(),
      };
      await push(ref(db, 'trades'), offer);
      setMsg('Proposta enviada!');
      setOfferedIds(new Set());
      setRequestedIds(new Set());
      setTargetUser('');
    } catch {
      setMsg('Erro ao enviar proposta');
    } finally {
      setSending(false);
    }
  }

  async function respondTrade(tradeId: string, accept: boolean) {
    try {
      const trade = trades.find(t => t.id === tradeId);
      if (!trade) return;

      if (accept) {
        // Swap players in Firebase
        const fromTeamSnap = await get(ref(db, `users/${trade.from}/team`));
        const toTeamSnap = await get(ref(db, `users/${trade.to}/team`));
        let fromTeam: Player[] = fromTeamSnap.val() || [];
        let toTeam: Player[] = toTeamSnap.val() || [];

        const offeredIds = new Set(trade.offeredPlayers.map(p => p.id));
        const requestedIds = new Set(trade.requestedPlayers.map(p => p.id));

        // Remove traded players and add received ones
        fromTeam = fromTeam.filter(p => !offeredIds.has(p.id));
        fromTeam.push(...trade.requestedPlayers);

        toTeam = toTeam.filter(p => !requestedIds.has(p.id));
        toTeam.push(...trade.offeredPlayers);

        await set(ref(db, `users/${trade.from}/team`), fromTeam);
        await set(ref(db, `users/${trade.to}/team`), toTeam);
      }

      await set(ref(db, `trades/${tradeId}/status`), accept ? 'accepted' : 'rejected');
      setMsg(accept ? 'Troca aceita!' : 'Troca recusada');
    } catch {
      setMsg('Erro ao processar troca');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Mercado</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800 rounded-xl p-1">
        {[
          { id: 'received' as const, label: 'Recebidas', count: receivedTrades.length },
          { id: 'sent' as const, label: 'Enviadas', count: sentTrades.length },
          { id: 'new' as const, label: 'Nova Proposta', count: 0 },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors relative ${
              tab === t.id ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {msg && <p className={`text-center text-sm ${msg.includes('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>{msg}</p>}

      {/* Received Trades */}
      {tab === 'received' && (
        <div className="space-y-3">
          {receivedTrades.length === 0 ? (
            <div className="bg-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-500 text-sm">Nenhuma proposta recebida</p>
            </div>
          ) : (
            receivedTrades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} onRespond={respondTrade} />
            ))
          )}
        </div>
      )}

      {/* Sent Trades */}
      {tab === 'sent' && (
        <div className="space-y-3">
          {sentTrades.length === 0 ? (
            <div className="bg-zinc-800 rounded-2xl p-6 text-center">
              <p className="text-zinc-500 text-sm">Nenhuma proposta enviada</p>
            </div>
          ) : (
            sentTrades.map((trade) => (
              <div key={trade.id} className="bg-zinc-800 rounded-2xl p-4">
                <p className="text-zinc-400 text-xs mb-2">Para: <span className="text-white font-medium">{trade.to}</span></p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <p className="text-red-400 text-[10px] font-bold mb-1">OFERECIDOS</p>
                    {trade.offeredPlayers.map(p => (
                      <p key={p.id} className="text-zinc-300 text-xs">{p.name}</p>
                    ))}
                  </div>
                  <div className="text-zinc-600 self-center">&#8644;</div>
                  <div className="flex-1">
                    <p className="text-emerald-400 text-[10px] font-bold mb-1">PEDIDOS</p>
                    {trade.requestedPlayers.map(p => (
                      <p key={p.id} className="text-zinc-300 text-xs">{p.name}</p>
                    ))}
                  </div>
                </div>
                <p className="text-zinc-600 text-[10px] mt-2">Aguardando resposta...</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* New Trade */}
      {tab === 'new' && (
        <div className="space-y-4">
          {/* Select target user */}
          <div className="bg-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-300 text-sm font-medium mb-2">Propor troca com:</p>
            <div className="flex gap-2 flex-wrap">
              {allUsers.map((nick) => (
                <button
                  key={nick}
                  onClick={() => { setTargetUser(nick); setRequestedIds(new Set()); }}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                    targetUser === nick ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                  }`}
                >
                  {nick}
                </button>
              ))}
              {allUsers.length === 0 && <p className="text-zinc-500 text-xs">Nenhum outro usuario</p>}
            </div>
          </div>

          {/* My players to offer */}
          <div className="bg-zinc-800 rounded-2xl p-4">
            <p className="text-red-400 text-sm font-medium mb-2">Seus jogadores (selecione para oferecer)</p>
            <div className="space-y-1 max-h-48 overflow-y-auto hide-scrollbar">
              {myTeam.map((p) => (
                <button
                  key={p.id}
                  onClick={() => toggleOffered(p.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                    offeredIds.has(p.id) ? 'bg-red-500/20 border border-red-500/40' : 'bg-zinc-700/30 hover:bg-zinc-700/50'
                  }`}
                >
                  <span className="text-zinc-500 text-[10px] w-4">{p.position}</span>
                  <span className="text-white text-xs flex-1 truncate">{p.name}</span>
                  <span className="text-zinc-400 text-[10px]">{p.team}</span>
                  {offeredIds.has(p.id) && <span className="text-red-400 text-xs">x</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Target user's players to request */}
          {targetUser && (
            <div className="bg-zinc-800 rounded-2xl p-4">
              <p className="text-emerald-400 text-sm font-medium mb-2">Jogadores de {targetUser} (selecione para pedir)</p>
              <div className="space-y-1 max-h-48 overflow-y-auto hide-scrollbar">
                {targetTeam.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => toggleRequested(p.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors ${
                      requestedIds.has(p.id) ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-zinc-700/30 hover:bg-zinc-700/50'
                    }`}
                  >
                    <span className="text-zinc-500 text-[10px] w-4">{p.position}</span>
                    <span className="text-white text-xs flex-1 truncate">{p.name}</span>
                    <span className="text-zinc-400 text-[10px]">{p.team}</span>
                    {requestedIds.has(p.id) && <span className="text-emerald-400 text-xs">+</span>}
                  </button>
                ))}
                {targetTeam.length === 0 && <p className="text-zinc-500 text-xs">Sem jogadores</p>}
              </div>
            </div>
          )}

          {/* Summary & Send */}
          {(offeredIds.size > 0 || requestedIds.size > 0) && (
            <div className="bg-zinc-800 rounded-2xl p-4">
              <p className="text-white text-sm font-medium mb-2">Resumo da proposta</p>
              <div className="flex gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-red-400 text-[10px] font-bold">VOCE OFERECE ({offeredIds.size})</p>
                  {myTeam.filter(p => offeredIds.has(p.id)).map(p => (
                    <p key={p.id} className="text-zinc-300 text-xs">{p.name}</p>
                  ))}
                </div>
                <div className="flex-1">
                  <p className="text-emerald-400 text-[10px] font-bold">VOCE PEDE ({requestedIds.size})</p>
                  {targetTeam.filter(p => requestedIds.has(p.id)).map(p => (
                    <p key={p.id} className="text-zinc-300 text-xs">{p.name}</p>
                  ))}
                </div>
              </div>
              <button
                onClick={sendTrade}
                disabled={sending || !targetUser || offeredIds.size === 0 || requestedIds.size === 0}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 text-white font-semibold rounded-xl transition-colors"
              >
                {sending ? 'Enviando...' : 'Enviar Proposta'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TradeCard({ trade, onRespond }: { trade: TradeOffer; onRespond: (id: string, accept: boolean) => void }) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-4">
      <p className="text-zinc-400 text-xs mb-2">De: <span className="text-white font-medium">{trade.from}</span></p>
      <div className="flex gap-3 mb-3">
        <div className="flex-1">
          <p className="text-emerald-400 text-[10px] font-bold mb-1">VOCE RECEBE</p>
          {trade.offeredPlayers.map(p => (
            <p key={p.id} className="text-zinc-300 text-xs">{p.name} <span className="text-zinc-500">({p.position})</span></p>
          ))}
        </div>
        <div className="text-zinc-600 self-center">&#8644;</div>
        <div className="flex-1">
          <p className="text-red-400 text-[10px] font-bold mb-1">VOCE DA</p>
          {trade.requestedPlayers.map(p => (
            <p key={p.id} className="text-zinc-300 text-xs">{p.name} <span className="text-zinc-500">({p.position})</span></p>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onRespond(trade.id, true)}
          className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors"
        >
          Aceitar
        </button>
        <button
          onClick={() => onRespond(trade.id, false)}
          className="flex-1 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-bold rounded-xl transition-colors"
        >
          Recusar
        </button>
      </div>
    </div>
  );
}
