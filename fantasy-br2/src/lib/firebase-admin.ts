// Server-side Firebase helpers for API routes
// Uses REST API directly (no admin SDK needed for free tier)

const DB_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '';

export async function firebaseGet(path: string) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`Firebase GET failed: ${res.status}`);
  return res.json();
}

export async function firebaseSet(path: string, data: unknown, authToken?: string) {
  const url = authToken
    ? `${DB_URL}/${path}.json?auth=${authToken}`
    : `${DB_URL}/${path}.json`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase SET failed: ${res.status}`);
  return res.json();
}

export async function firebaseUpdate(path: string, data: unknown, authToken?: string) {
  const url = authToken
    ? `${DB_URL}/${path}.json?auth=${authToken}`
    : `${DB_URL}/${path}.json`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Firebase PATCH failed: ${res.status}`);
  return res.json();
}
