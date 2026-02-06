import { NextResponse } from 'next/server';
import { apiFootballFetch, getLeagueId, getCurrentSeason } from '@/lib/api-football';
import { firebaseGet, firebaseSet } from '@/lib/firebase-admin';

// GET /api/sync
// Auto-sync endpoint - can be called by Vercel Cron or manually
// Syncs players and detects season changes automatically

export async function GET() {
  const currentYear = getCurrentSeason();
  const leagueId = getLeagueId();

  try {
    // Step 1: Check if we need to sync (auto-season detection)
    const lastSync = await firebaseGet('gameData/players/lastSync');
    const lastSyncDate = lastSync ? new Date(lastSync) : null;

    // Don't sync more than once per day
    if (lastSyncDate) {
      const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / 3600000;
      if (hoursSinceSync < 24) {
        return NextResponse.json({
          message: 'Sync recente, pulando',
          lastSync: lastSync,
          hoursSince: Math.round(hoursSinceSync),
        });
      }
    }

    // Step 2: Check if API has data for current year
    const teamsData = await apiFootballFetch('/teams', {
      league: leagueId,
      season: String(currentYear),
    }) as { response?: Array<{ team: { id: number; name: string; logo: string } }> };
    const teams = teamsData?.response || [];

    // If no teams for current year, try previous year (off-season)
    let season = String(currentYear);
    if (teams.length === 0) {
      const prevData = await apiFootballFetch('/teams', {
        league: leagueId,
        season: String(currentYear - 1),
      }) as { response?: Array<{ team: { id: number; name: string; logo: string } }> };
      const prevTeams = prevData?.response || [];

      if (prevTeams.length > 0) {
        season = String(currentYear - 1);
        // Use previous year's teams
        teams.push(...prevTeams);
      } else {
        return NextResponse.json({
          message: 'Nenhum time encontrado para a temporada atual ou anterior',
          season: currentYear,
        });
      }
    }

    // Step 3: Fetch squads for all teams
    const allPlayers: Array<{
      id: number;
      name: string;
      photo: string;
      position: string;
      team: string;
      teamLogo: string;
      price: number;
      points: number;
    }> = [];

    const teamsList: Array<{ id: number; name: string; logo: string }> = [];
    const failedTeams: string[] = [];

    for (const teamEntry of teams) {
      const team = teamEntry.team;
      teamsList.push({ id: team.id, name: team.name, logo: team.logo });

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 2000 * attempt));
          }

          const squadData = await apiFootballFetch('/players/squads', {
            team: String(team.id),
          }) as { response?: Array<{ players: Array<{ id: number; name: string; photo: string; position: string }> }> };
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
          break; // success
        } catch {
          if (attempt === 2) failedTeams.push(team.name);
        }
      }

      // Rate limit protection
      await new Promise((r) => setTimeout(r, 200));
    }

    // Step 4: Save to Firebase (only if enough players)
    if (allPlayers.length >= 100) {
      // Preserve existing points from previous data
      const existingData = await firebaseGet('gameData/players');
      if (existingData?.players) {
        const pointsMap: Record<number, number> = {};
        for (const p of existingData.players) {
          if (p.points) pointsMap[p.id] = p.points;
        }
        for (const p of allPlayers) {
          if (pointsMap[p.id]) p.points = pointsMap[p.id];
        }
      }

      await firebaseSet('gameData/players', {
        players: allPlayers,
        teams: teamsList,
        lastSync: new Date().toISOString(),
        season: parseInt(season),
      });

      // Update season config
      await firebaseSet('config/season', {
        year: parseInt(season),
        leagueId: parseInt(leagueId),
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      message: 'Sync concluido',
      season: parseInt(season),
      teams: teamsList.length,
      players: allPlayers.length,
      failedTeams,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
