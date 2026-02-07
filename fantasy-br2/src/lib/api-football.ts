// Server-side API-Football client
// Keys are NEVER exposed to the browser

const BASE_URL = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const LEAGUE_ID = process.env.API_FOOTBALL_LEAGUE_ID || '71';

const KEYS = [
  process.env.API_FOOTBALL_KEY_1,
  process.env.API_FOOTBALL_KEY_2,
  process.env.API_FOOTBALL_KEY_3,
].filter(Boolean) as string[];

let currentKeyIndex = 0;

function getNextKey(): string {
  if (KEYS.length === 0) throw new Error('No API-Football keys configured');
  const key = KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % KEYS.length;
  return key;
}

export async function apiFootballFetch(
  endpoint: string,
  params: Record<string, string> = {},
  retries = 3
): Promise<unknown> {
  const url = new URL(endpoint, BASE_URL);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  for (let attempt = 0; attempt < retries; attempt++) {
    const key = getNextKey();
    try {
      const res = await fetch(url.toString(), {
        headers: { 'x-apisports-key': key },
      });

      if (res.status === 429) {
        // Rate limited - wait and try next key
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) throw new Error(`API-Football ${res.status}: ${res.statusText}`);

      const data = await res.json();
      return data;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw new Error('API-Football: all retries exhausted');
}

export function getLeagueId() {
  return LEAGUE_ID;
}

export function getCurrentSeason(): number {
  // Brasileirão season = calendar year
  return new Date().getFullYear();
}
