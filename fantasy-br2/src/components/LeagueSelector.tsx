'use client';

import { useState, useEffect } from 'react';
import { ref, get, push, set, update } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useStore, League } from '@/store/useStore';

export default function LeagueSelector() {
  const { uid, nickname, setCurrentLeague, setAuth, appearance } = useStore();
  const [tab, setTab] = useState<'list' | 'create' | 'join'>('list');
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const [leagueName, setLeagueName] = useState('');
  const [maxMembers, setMaxMembers] = useState(12);

  const [accessCode, setAccessCode] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!uid) return;
    loadLeagues();
  }, [uid]);

  async function loadLeagues() {
    if (!uid) return;
    setLoading(true);
    try {
      const accountSnap = await get(ref(db, `accounts/${uid}/leagues`));
      const leagueIds = accountSnap.val() || {};
      const leagues: League[] = [];
      for (const leagueId of Object.keys(leagueIds)) {
        const leagueSnap = await get(ref(db, `leagues/${leagueId}/info`));
        const data = leagueSnap.val();
        if (data) leagues.push({ ...data, id: leagueId });
      }
      setMyLeagues(leagues);
    } catch {
      setError('Erro ao carregar ligas');
    } finally {
      setLoading(false);
    }
  }

  function generateAccessCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function handleCreateLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueName.trim() || !uid || !nickname) return;
    setCreating(true);
    setError('');
    try {
      const code = generateAccessCode();
      const leagueData: Omit<League, 'id'> = {
        name: leagueName.trim(),
        logo: '',
        accessCode: code,
        adminUid: uid,
        adminNickname: nickname,
        season: new Date().getFullYear(),
        maxMembers,
        createdAt: new Date().toISOString(),
      };
      const leagueRef = push(ref(db, 'leagues'));
      const leagueId = leagueRef.key!;
      await set(ref(db, `leagues/${leagueId}/info`), leagueData);
      await set(ref(db, `leagues/${leagueId}/settings`), {
        draftRounds: 16,
        draftTimerSeconds: 90,
        maxTradesPerMonth: 3,
        marketOpen: false,
        captainMultiplier: 2,
      });
      await set(ref(db, `leagues/${leagueId}/round`), {
        number: 1, status: 'waiting', deadline: null, nextGameDate: null,
      });
      await update(ref(db, `accounts/${uid}/leagues`), { [leagueId]: 'admin' });
      await set(ref(db, `leagues/${leagueId}/admins/${uid}`), true);
      setCurrentLeague({ ...leagueData, id: leagueId });
    } catch {
      setError('Erro ao criar liga');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!accessCode.trim() || !uid || !nickname) return;
    setJoining(true);
    setError('');
    try {
      const leaguesSnap = await get(ref(db, 'leagues'));
      const allLeagues = leaguesSnap.val() || {};
      let foundId: string | null = null;
      let foundLeague: League | null = null;
      for (const [id, data] of Object.entries(allLeagues)) {
        const info = (data as { info?: League }).info;
        if (info?.accessCode === accessCode.trim().toUpperCase()) {
          foundId = id;
          foundLeague = { ...info, id };
          break;
        }
      }
      if (!foundId || !foundLeague) {
        setError('Codigo de acesso invalido');
        setJoining(false);
        return;
      }
      if (foundLeague.adminUid === uid) {
        // Admin entering their own league
        setCurrentLeague(foundLeague);
        setJoining(false);
        return;
      }
      const membersSnap = await get(ref(db, `leagues/${foundId}/members`));
      const membersCount = membersSnap.exists() ? Object.keys(membersSnap.val()).length : 0;
      if (membersCount >= foundLeague.maxMembers) {
        setError('Liga cheia!');
        setJoining(false);
        return;
      }
      const existingMember = await get(ref(db, `leagues/${foundId}/members/${nickname}`));
      if (existingMember.exists()) {
        setCurrentLeague(foundLeague);
        setJoining(false);
        return;
      }
      await set(ref(db, `leagues/${foundId}/members/${nickname}`), {
        nickname,
        team: [],
        formation: '4-3-3',
        totalPoints: 0,
        confirmed: false,
        captain: null,
        joinedAt: new Date().toISOString(),
      });
      await update(ref(db, `accounts/${uid}/leagues`), { [foundId]: 'member' });
      setCurrentLeague(foundLeague);
    } catch {
      setError('Erro ao entrar na liga');
    } finally {
      setJoining(false);
    }
  }

  function handleLogout() {
    signOut(auth);
    setAuth(null, null, false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-8">
      <div className="max-w-sm mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm"
              style={{ backgroundColor: appearance.primaryColor }}
            >
              {appearance.logoText}
            </div>
            <div>
              <p className="text-white font-semibold">{appearance.siteName}</p>
              <p className="text-zinc-500 text-xs">Ola, {nickname}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 rounded-lg transition-colors">
            Sair
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800 rounded-xl p-1 mb-6">
          {([
            { id: 'list' as const, label: 'Minhas Ligas' },
            { id: 'create' as const, label: 'Criar Liga' },
            { id: 'join' as const, label: 'Entrar' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setError(''); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

        {/* MY LEAGUES */}
        {tab === 'list' && (
          <div className="space-y-3">
            {loading ? (
              <div className="bg-zinc-800 rounded-2xl p-6 text-center">
                <p className="text-zinc-500 text-sm">Carregando...</p>
              </div>
            ) : myLeagues.length === 0 ? (
              <div className="bg-zinc-800 rounded-2xl p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-white font-semibold mb-1">Nenhuma liga</p>
                <p className="text-zinc-500 text-sm mb-4">Crie uma liga ou entre com um codigo</p>
                <div className="flex gap-2">
                  <button onClick={() => setTab('create')} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors">
                    Criar Liga
                  </button>
                  <button onClick={() => setTab('join')} className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-xl transition-colors">
                    Entrar
                  </button>
                </div>
              </div>
            ) : (
              myLeagues.map((league) => {
                const isAdmin = league.adminUid === uid;
                return (
                  <button
                    key={league.id}
                    onClick={() => setCurrentLeague(league)}
                    className="w-full bg-zinc-800 hover:bg-zinc-700/80 rounded-2xl p-4 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white font-bold text-lg shrink-0">
                        {league.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{league.name}</p>
                        <p className="text-zinc-500 text-xs">
                          Temporada {league.season}
                          {isAdmin && <span className="text-amber-400 ml-2">ADMIN</span>}
                        </p>
                      </div>
                      <svg className="w-5 h-5 text-zinc-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* CREATE LEAGUE */}
        {tab === 'create' && (
          <form onSubmit={handleCreateLeague} className="space-y-4">
            <div className="bg-zinc-800 rounded-2xl p-5 space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Nome da Liga</label>
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="Ex: Liga dos Amigos 2026"
                  className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  maxLength={40}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Maximo de Jogadores</label>
                <div className="flex gap-2">
                  {[6, 8, 10, 12, 16, 20].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMaxMembers(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        maxMembers === n ? 'bg-emerald-500 text-white' : 'bg-zinc-600 text-zinc-400 hover:bg-zinc-500'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3">
                <p className="text-amber-400 text-xs font-medium">Voce sera o ADMIN desta liga</p>
                <p className="text-zinc-500 text-[11px] mt-1">
                  O admin gerencia tudo pelo painel. Admin nao participa como jogador.
                </p>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating || !leagueName.trim()}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-xl transition-colors"
            >
              {creating ? 'Criando...' : 'Criar Liga'}
            </button>
          </form>
        )}

        {/* JOIN LEAGUE */}
        {tab === 'join' && (
          <form onSubmit={handleJoinLeague} className="space-y-4">
            <div className="bg-zinc-800 rounded-2xl p-5">
              <label className="block text-sm text-zinc-400 mb-1.5">Codigo de Acesso</label>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white text-center text-xl font-mono tracking-widest placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors uppercase"
                maxLength={6}
              />
              <p className="text-zinc-500 text-xs mt-3 text-center">
                Peca o codigo para o administrador da liga
              </p>
            </div>
            <button
              type="submit"
              disabled={joining || accessCode.trim().length < 4}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-xl transition-colors"
            >
              {joining ? 'Entrando...' : 'Entrar na Liga'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
