import { NextRequest, NextResponse } from 'next/server';
import { apiFootballFetch, getLeagueId, getCurrentSeason } from '@/lib/api-football';

// Server-side API route - keys never exposed to client
// GET /api/football?action=teams|fixtures|squads&team=123

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const action = searchParams.get('action');
  const season = searchParams.get('season') || String(getCurrentSeason());
  const leagueId = getLeagueId();

  try {
    switch (action) {
      case 'teams': {
        const data = await apiFootballFetch('/teams', {
          league: leagueId,
          season,
        });
        return NextResponse.json(data);
      }

      case 'fixtures': {
        const round = searchParams.get('round') || '';
        const params: Record<string, string> = { league: leagueId, season };
        if (round) params.round = round;
        const data = await apiFootballFetch('/fixtures', params);
        return NextResponse.json(data);
      }

      case 'squads': {
        const teamId = searchParams.get('team');
        if (!teamId) {
          return NextResponse.json({ error: 'team parameter required' }, { status: 400 });
        }
        const data = await apiFootballFetch('/players/squads', { team: teamId });
        return NextResponse.json(data);
      }

      case 'status': {
        const data = await apiFootballFetch('/status');
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: teams, fixtures, squads, status' },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
