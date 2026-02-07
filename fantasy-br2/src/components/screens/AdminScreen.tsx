'use client';

import { useState } from 'react';
import { ref, set, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';
import { DEFAULT_APPEARANCE, AppearanceConfig } from '@/lib/appearance';

type AdminTab = 'main' | 'appearance' | 'draft' | 'sync' | 'scoring';

export default function AdminScreen() {
  const { user, players, appearance, setAppearance } = useStore();
  const [tab, setTab] = useState<AdminTab>('main');
  const [loading, setLoading] = useState('');
  const [msg, setMsg] = useState('');

  if (!user?.isAdmin) {
    return (
      <div className="bg-zinc-800 rounded-2xl p-6 text-center">
        <p className="text-red-400">Acesso restrito a administradores.</p>
      </div>
    );
  }

  // ── APPEARANCE TAB ──
  function AppearanceTab() {
    const [config, setConfig] = useState<AppearanceConfig>(appearance);

    async function saveAppearance() {
      setLoading('appearance');
      try {
        await set(ref(db, 'config/appearance'), config);
        setAppearance(config);
        setMsg('Aparencia salva!');
      } catch {
        setMsg('Erro ao salvar aparencia');
      } finally {
        setLoading('');
      }
    }

    function resetAppearance() {
      setConfig(DEFAULT_APPEARANCE);
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Aparencia</h3>
          <button onClick={() => setTab('main')} className="text-zinc-400 text-sm">Voltar</button>
        </div>

        {/* Logo */}
        <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-zinc-300 text-sm font-medium">Logo</p>
          <input
            type="text"
            placeholder="URL da logo (ex: https://...)"
            value={config.logoUrl}
            onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Texto da logo (ex: FB)"
            value={config.logoText}
            onChange={(e) => setConfig({ ...config, logoText: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Nome do site"
            value={config.siteName}
            onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm placeholder-zinc-500 focus:outline-none"
          />
        </div>

        {/* Colors */}
        <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-zinc-300 text-sm font-medium">Cores</p>
          {[
            { label: 'Primaria', key: 'primaryColor' as const },
            { label: 'Secundaria', key: 'secondaryColor' as const },
            { label: 'Destaque', key: 'accentColor' as const },
            { label: 'Fundo', key: 'backgroundColor' as const },
            { label: 'Cards', key: 'cardColor' as const },
            { label: 'Texto', key: 'textColor' as const },
          ].map(({ label, key }) => (
            <div key={key} className="flex items-center gap-3">
              <input
                type="color"
                value={config[key]}
                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                className="w-10 h-10 rounded-lg border-0 cursor-pointer bg-transparent"
              />
              <div className="flex-1">
                <p className="text-zinc-300 text-xs">{label}</p>
                <p className="text-zinc-500 text-xs font-mono">{config[key]}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Typography */}
        <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-zinc-300 text-sm font-medium">Tipografia</p>
          <select
            value={config.fontFamily}
            onChange={(e) => setConfig({ ...config, fontFamily: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm focus:outline-none"
          >
            <option value="system-ui">System UI</option>
            <option value="Arial">Arial</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="monospace">Monospace</option>
          </select>
          <div className="flex gap-2">
            {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setConfig({ ...config, headingSize: size })}
                className={`flex-1 py-2 rounded-xl text-xs font-medium ${
                  config.headingSize === size ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* League info */}
        <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-zinc-300 text-sm font-medium">Liga</p>
          <input
            type="text"
            value={config.leagueName}
            onChange={(e) => setConfig({ ...config, leagueName: e.target.value })}
            className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm focus:outline-none"
          />
          <input
            type="number"
            value={config.seasonYear}
            onChange={(e) => setConfig({ ...config, seasonYear: parseInt(e.target.value) || 2026 })}
            className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm focus:outline-none"
          />
        </div>

        {/* Preview */}
        <div
          className="rounded-2xl p-4"
          style={{ backgroundColor: config.cardColor, color: config.textColor }}
        >
          <p className="text-xs opacity-60">Preview</p>
          <p style={{ fontFamily: config.fontFamily, color: config.primaryColor, fontWeight: 'bold' }}>
            {config.siteName} - {config.leagueName} {config.seasonYear}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={resetAppearance}
            className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-xl text-sm transition-colors"
          >
            Resetar
          </button>
          <button
            onClick={saveAppearance}
            disabled={loading === 'appearance'}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            {loading === 'appearance' ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    );
  }

  // ── DRAFT MANAGEMENT TAB ──
  function DraftTab() {
    const [timerSec, setTimerSec] = useState(90);
    const [totalRounds, setTotalRounds] = useState(16);

    async function startDraft() {
      setLoading('draft');
      try {
        // Get all registered users
        const usersSnap = await get(ref(db, 'users'));
        const usersData = usersSnap.val() || {};
        const nicknames = Object.keys(usersData);

        if (nicknames.length < 2) {
          setMsg('Precisa de pelo menos 2 usuarios registrados');
          setLoading('');
          return;
        }

        // Shuffle for random order
        const shuffled = [...nicknames].sort(() => Math.random() - 0.5);

        // Get all player IDs
        const availableIds = players.map((p) => p.id);

        await set(ref(db, 'draft'), {
          status: 'active',
          participants: shuffled,
          currentPick: 0,
          totalRounds,
          pickTimerSeconds: timerSec,
          pickStartedAt: Date.now(),
          picks: {},
          availablePlayers: availableIds,
        });

        setMsg(`Draft iniciado! ${shuffled.length} participantes`);
      } catch {
        setMsg('Erro ao iniciar draft');
      } finally {
        setLoading('');
      }
    }

    async function resetDraft() {
      setLoading('draft-reset');
      try {
        await set(ref(db, 'draft'), { status: 'waiting' });
        setMsg('Draft resetado');
      } catch {
        setMsg('Erro ao resetar draft');
      } finally {
        setLoading('');
      }
    }

    async function pauseDraft() {
      setLoading('draft-pause');
      try {
        await set(ref(db, 'draft/status'), 'paused');
        setMsg('Draft pausado');
      } catch {
        setMsg('Erro');
      } finally {
        setLoading('');
      }
    }

    async function resumeDraft() {
      setLoading('draft-resume');
      try {
        await set(ref(db, 'draft/status'), 'active');
        await set(ref(db, 'draft/pickStartedAt'), Date.now());
        setMsg('Draft retomado');
      } catch {
        setMsg('Erro');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Gerenciar Draft</h3>
          <button onClick={() => setTab('main')} className="text-zinc-400 text-sm">Voltar</button>
        </div>

        {/* Config */}
        <div className="bg-zinc-800 rounded-2xl p-4 space-y-3">
          <p className="text-zinc-300 text-sm font-medium">Configuracao</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-zinc-500 text-xs">Timer (seg)</label>
              <input
                type="number"
                value={timerSec}
                onChange={(e) => setTimerSec(parseInt(e.target.value) || 90)}
                className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm mt-1 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-zinc-500 text-xs">Rodadas</label>
              <input
                type="number"
                value={totalRounds}
                onChange={(e) => setTotalRounds(parseInt(e.target.value) || 16)}
                className="w-full px-3 py-2 bg-zinc-700 rounded-xl text-white text-sm mt-1 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={startDraft}
            disabled={!!loading}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 text-white font-semibold rounded-xl transition-colors"
          >
            {loading === 'draft' ? 'Iniciando...' : 'Iniciar Draft'}
          </button>
          <div className="flex gap-2">
            <button
              onClick={pauseDraft}
              disabled={!!loading}
              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-600 text-white rounded-xl text-sm transition-colors"
            >
              Pausar
            </button>
            <button
              onClick={resumeDraft}
              disabled={!!loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 text-white rounded-xl text-sm transition-colors"
            >
              Retomar
            </button>
          </div>
          <button
            onClick={resetDraft}
            disabled={!!loading}
            className="w-full py-3 bg-red-600/30 hover:bg-red-600/50 disabled:bg-zinc-600 text-red-400 rounded-xl text-sm transition-colors"
          >
            {loading === 'draft-reset' ? 'Resetando...' : 'Resetar Draft'}
          </button>
        </div>

        <p className="text-zinc-500 text-xs text-center">
          Jogadores disponiveis: {players.length}
        </p>
      </div>
    );
  }

  // ── SYNC TAB ──
  function SyncTab() {
    const [syncStatus, setSyncStatus] = useState('');

    async function syncPlayers() {
      setLoading('sync');
      setSyncStatus('Buscando times...');
      try {
        // Use our server-side API route
        const teamsRes = await fetch('/api/football?action=teams');
        const teamsData = await teamsRes.json();
        const teams = teamsData?.response || [];

        if (teams.length === 0) {
          setSyncStatus('Nenhum time encontrado');
          setLoading('');
          return;
        }

        setSyncStatus(`${teams.length} times. Buscando elencos...`);
        const allPlayers: unknown[] = [];

        for (let i = 0; i < teams.length; i++) {
          const team = teams[i].team;
          setSyncStatus(`(${i + 1}/${teams.length}) ${team.name}...`);

          try {
            const squadRes = await fetch(`/api/football?action=squads&team=${team.id}`);
            const squadData = await squadRes.json();
            const squad = squadData?.response?.[0]?.players || [];

            for (const p of squad) {
              allPlayers.push({
                id: p.id,
                name: p.name,
                photo: p.photo || '',
                position: mapPosition(p.position),
                team: team.name,
                teamLogo: team.logo || '',
                price: 10,
                points: 0,
              });
            }
          } catch {
            setSyncStatus(`Erro no time ${team.name}, pulando...`);
            await new Promise((r) => setTimeout(r, 1000));
          }

          // Small delay to avoid rate limiting
          if (i < teams.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        setSyncStatus(`${allPlayers.length} jogadores. Salvando...`);

        if (allPlayers.length >= 100) {
          await set(ref(db, 'gameData/players'), {
            players: allPlayers,
            teams: teams.map((t: { team: { id: number; name: string; logo: string } }) => ({
              id: t.team.id,
              name: t.team.name,
              logo: t.team.logo,
            })),
            lastSync: new Date().toISOString(),
          });
          setSyncStatus(`Pronto! ${allPlayers.length} jogadores sincronizados`);
        } else {
          setSyncStatus(`Apenas ${allPlayers.length} jogadores - muito poucos, nao salvo`);
        }
      } catch (err) {
        setSyncStatus(`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`);
      } finally {
        setLoading('');
      }
    }

    async function checkApiStatus() {
      setLoading('api-check');
      try {
        const res = await fetch('/api/football?action=status');
        const data = await res.json();
        const account = data?.response?.account;
        const requests = data?.response?.requests;
        setSyncStatus(
          `Status: ${account?.firstname || 'OK'} | ` +
          `Requests hoje: ${requests?.current || '?'}/${requests?.limit_day || '?'}`
        );
      } catch {
        setSyncStatus('Erro ao verificar API');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Jogadores & Sync</h3>
          <button onClick={() => setTab('main')} className="text-zinc-400 text-sm">Voltar</button>
        </div>

        <div className="bg-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-300 text-sm">Jogadores no sistema: <span className="text-white font-bold">{players.length}</span></p>
        </div>

        {syncStatus && (
          <div className="bg-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">{syncStatus}</p>
          </div>
        )}

        <button
          onClick={syncPlayers}
          disabled={!!loading}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 text-white font-semibold rounded-xl transition-colors"
        >
          {loading === 'sync' ? 'Sincronizando...' : 'Sincronizar Jogadores (API)'}
        </button>

        <button
          onClick={checkApiStatus}
          disabled={!!loading}
          className="w-full py-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-600 text-zinc-300 rounded-xl text-sm transition-colors"
        >
          {loading === 'api-check' ? 'Verificando...' : 'Verificar Status da API'}
        </button>
      </div>
    );
  }

  // ── SCORING TAB ──
  function ScoringTab() {
    async function calculateScores() {
      setLoading('scoring');
      try {
        const res = await fetch('/api/scoring');
        const data = await res.json();
        if (data.error) {
          setMsg(`Erro: ${data.error}`);
        } else {
          setMsg(`Pontuacao calculada: ${data.playersScored || 0} jogadores`);
        }
      } catch {
        setMsg('Erro ao calcular pontuacao');
      } finally {
        setLoading('');
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Pontuacao</h3>
          <button onClick={() => setTab('main')} className="text-zinc-400 text-sm">Voltar</button>
        </div>

        <div className="bg-zinc-800 rounded-2xl p-4">
          <p className="text-zinc-300 text-sm mb-3">Sistema de pontos:</p>
          <div className="space-y-1 text-xs text-zinc-400">
            <p>Gol (ATA: 4 | MEI: 5 | DEF: 6 | GOL: 7)</p>
            <p>Assistencia: 3 pts</p>
            <p>Clean Sheet (DEF/GOL): 4 pts</p>
            <p>Cartao Amarelo: -1 | Vermelho: -3</p>
            <p>Defesa (GOL): 0.5 pts</p>
            <p>Penalti marcado: +1 | Perdido: -2</p>
            <p>60+ min: 2 pts | &lt;60 min: 1 pt</p>
            <p>Gol contra: -2 pts</p>
          </div>
        </div>

        <button
          onClick={calculateScores}
          disabled={!!loading}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-600 text-white font-semibold rounded-xl transition-colors"
        >
          {loading === 'scoring' ? 'Calculando...' : 'Calcular Pontuacao da Rodada'}
        </button>
      </div>
    );
  }

  // ── MAIN TAB ──
  if (tab === 'appearance') return <AppearanceTab />;
  if (tab === 'draft') return <DraftTab />;
  if (tab === 'sync') return <SyncTab />;
  if (tab === 'scoring') return <ScoringTab />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Painel Admin</h2>

      {msg && (
        <div className="bg-zinc-800 rounded-xl p-3 text-center">
          <p className="text-emerald-400 text-sm">{msg}</p>
          <button onClick={() => setMsg('')} className="text-zinc-500 text-xs mt-1">fechar</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setTab('appearance')} className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Aparencia</p>
          <p className="text-zinc-500 text-xs mt-1">Logo, cores, fontes</p>
        </button>
        <button onClick={() => setTab('draft')} className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Draft</p>
          <p className="text-zinc-500 text-xs mt-1">Iniciar/gerenciar</p>
        </button>
        <button onClick={() => setTab('sync')} className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Jogadores</p>
          <p className="text-zinc-500 text-xs mt-1">Sync API / manual</p>
        </button>
        <button onClick={() => setTab('scoring')} className="bg-zinc-800 hover:bg-zinc-700 rounded-2xl p-4 text-left transition-colors">
          <p className="text-amber-400 font-semibold">Pontuacao</p>
          <p className="text-zinc-500 text-xs mt-1">Calcular/conferir</p>
        </button>
      </div>

      <div className="bg-zinc-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-3">Status do Sistema</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Jogadores</span>
            <span className="text-emerald-400">{players.length}</span>
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

function mapPosition(pos: string): string {
  if (!pos) return 'M';
  const p = pos.toLowerCase();
  if (p.includes('goalkeeper')) return 'G';
  if (p.includes('defender')) return 'D';
  if (p.includes('midfielder')) return 'M';
  if (p.includes('attacker') || p.includes('forward')) return 'A';
  return 'M';
}
