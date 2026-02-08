import { NextRequest, NextResponse } from 'next/server';
import { apiFootballFetch, getLeagueId, getCurrentSeason } from '@/lib/api-football';
import { firebaseGet, firebaseSet } from '@/lib/firebase-admin';
import { calculatePlayerPoints, PlayerMatchStats, ScoringRules, DEFAULT_SCORING } from '@/lib/scoring';

// GET /api/scoring?round=1&league=leagueId
// Fetches match events and calculates points for all players in that round
// If league is provided, also updates member totalPoints within that league

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const round = searchParams.get('round');
  const leagueId = searchParams.get('league');
  const season = String(getCurrentSeason());
  const leagueApiId = getLeagueId();

  try {
    // Get fixtures for the round
    const params: Record<string, string> = { league: leagueApiId, season };
    if (round) params.round = `Regular Season - ${round}`;

    const fixturesData = await apiFootballFetch('/fixtures', params) as {
      response?: Array<{
        fixture: { id: number; status: { short: string } };
        teams: { home: { id: number }; away: { id: number } };
        goals: { home: number; away: number };
      }>;
    };
    const fixtures = fixturesData?.response || [];

    const finishedFixtures = fixtures.filter(
      (f) => f.fixture.status.short === 'FT'
    );

    if (finishedFixtures.length === 0) {
      return NextResponse.json({
        message: 'Nenhum jogo finalizado nesta rodada',
        playersScored: 0,
      });
    }

    // Load custom scoring rules from the league if provided
    let scoringRules: ScoringRules = DEFAULT_SCORING;
    let captainMultiplier = 2;
    if (leagueId) {
      const settings = await firebaseGet(`leagues/${leagueId}/settings`);
      if (settings?.scoringRules) {
        scoringRules = { ...DEFAULT_SCORING, ...settings.scoringRules };
      }
      if (settings?.captainMultiplier) {
        captainMultiplier = settings.captainMultiplier;
      }
    }

    // Get player stats for each finished fixture
    const playerPoints: Record<number, { name: string; points: number; stats: PlayerMatchStats }> = {};

    for (const fixture of finishedFixtures) {
      const statsData = await apiFootballFetch('/fixtures/players', {
        fixture: String(fixture.fixture.id),
      }) as {
        response?: Array<{
          team: { id: number };
          players: Array<{
            player: { id: number; name: string };
            statistics: Array<{
              games: { minutes: number; position: string };
              goals: { total: number; assists: number; conceded: number };
              penalty: { scored: number; missed: number };
              cards: { yellow: number; red: number };
              goals_saves?: number;
            }>;
          }>;
        }>;
      };
      const teams = statsData?.response || [];

      for (const team of teams) {
        const teamId = team.team.id;
        const isHome = fixture.teams.home.id === teamId;
        const goalsConceded = isHome ? fixture.goals.away : fixture.goals.home;
        const cleanSheet = goalsConceded === 0;

        for (const playerData of team.players || []) {
          const stat = playerData.statistics?.[0];
          if (!stat || !stat.games?.minutes) continue;

          const position = mapApiPosition(stat.games.position);
          const matchStats: PlayerMatchStats = {
            playerId: playerData.player.id,
            minutes: stat.games.minutes || 0,
            goals: stat.goals?.total || 0,
            assists: stat.goals?.assists || 0,
            saves: stat.goals_saves || 0,
            yellowCards: stat.cards?.yellow || 0,
            redCards: stat.cards?.red || 0,
            penaltiesScored: stat.penalty?.scored || 0,
            penaltiesMissed: stat.penalty?.missed || 0,
            ownGoals: 0,
            goalsConceded: goalsConceded || 0,
            cleanSheet,
            position,
          };

          const pts = calculatePlayerPoints(matchStats, scoringRules);

          if (!playerPoints[playerData.player.id]) {
            playerPoints[playerData.player.id] = {
              name: playerData.player.name,
              points: pts,
              stats: matchStats,
            };
          } else {
            playerPoints[playerData.player.id].points += pts;
          }
        }
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    // Save round scores globally
    const roundKey = round || 'latest';
    await firebaseSet(`scores/round_${roundKey}`, {
      fixtures: finishedFixtures.length,
      players: playerPoints,
      calculatedAt: new Date().toISOString(),
    });

    // If league provided, update member totalPoints within that league
    if (leagueId) {
      const membersData = await firebaseGet(`leagues/${leagueId}/members`);
      if (membersData) {
        for (const [memberNick, memberData] of Object.entries(membersData)) {
          const member = memberData as { team?: Array<{ id: number }>; totalPoints?: number; captain?: number | null };
          if (!member.team) continue;

          let roundPoints = 0;
          for (const player of member.team) {
            if (playerPoints[player.id]) {
              let pts = playerPoints[player.id].points;
              // Apply captain multiplier
              if (member.captain === player.id) {
                pts *= captainMultiplier;
              }
              roundPoints += pts;
            }
          }

          if (roundPoints !== 0) {
            const newTotal = (member.totalPoints || 0) + roundPoints;
            await firebaseSet(`leagues/${leagueId}/members/${memberNick}/totalPoints`, newTotal);
            await firebaseSet(`leagues/${leagueId}/members/${memberNick}/roundPoints/round_${roundKey}`, roundPoints);
          }
        }
      }
    }

    return NextResponse.json({
      message: `Pontuacao calculada para ${finishedFixtures.length} jogos`,
      playersScored: Object.keys(playerPoints).length,
      fixtures: finishedFixtures.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mapApiPosition(pos: string): string {
  if (!pos) return 'M';
  const p = pos.toLowerCase();
  if (p === 'g') return 'G';
  if (p === 'd') return 'D';
  if (p === 'm') return 'M';
  if (p === 'f') return 'A';
  return 'M';
}
