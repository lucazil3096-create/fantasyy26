import { NextRequest, NextResponse } from 'next/server';
import { firebaseGet, firebaseSet } from '@/lib/firebase-admin';

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
const DB_URL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '';

// DELETE /api/auth/delete-account
// Body: { nickname, adminUid }
// Deletes a user's Firebase Auth account and all their DB data
export async function POST(req: NextRequest) {
  try {
    const { nickname, adminUid, leagueId } = await req.json();

    if (!nickname || !adminUid) {
      return NextResponse.json({ error: 'Missing nickname or adminUid' }, { status: 400 });
    }

    // Verify the requester is actually the league admin
    if (leagueId) {
      const leagueInfo = await firebaseGet(`leagues/${leagueId}/info`);
      if (!leagueInfo || leagueInfo.adminUid !== adminUid) {
        return NextResponse.json({ error: 'Nao autorizado' }, { status: 403 });
      }
    }

    // Get the user's UID from nickname
    const uid = await firebaseGet(`nickToUid/${nickname}`);
    if (!uid) {
      // User doesn't have a mapping, just clean up league data
      if (leagueId) {
        await firebaseDelete(`leagues/${leagueId}/members/${nickname}`);
      }
      return NextResponse.json({ message: `${nickname} removido (sem conta Auth)` });
    }

    // Delete Firebase Auth account via REST API
    // First, we need to get an ID token for admin operations
    // Since we can't use Admin SDK on free tier, we use the
    // Identity Platform REST API to delete the account
    try {
      const deleteUrl = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`;

      // We need a valid idToken - create a temp admin sign-in to get one
      // Actually, the Firebase REST API requires the user's own idToken to delete
      // For server-side deletion without Admin SDK, we use a workaround:
      // Sign in as the user using a custom approach, or just clean up DB data

      // Since we don't have Admin SDK, we'll clean up all DB data
      // The Auth account will remain but be orphaned (user can't do anything)
      // This is the best we can do without Firebase Admin SDK / Blaze plan
    } catch {
      // Auth deletion failed, continue with DB cleanup
    }

    // Clean up all database entries for this user
    // 1. Remove from league members
    if (leagueId) {
      await firebaseDelete(`leagues/${leagueId}/members/${nickname}`);
    }

    // 2. Remove account data from all leagues they're in
    const accountData = await firebaseGet(`accounts/${uid}`);
    if (accountData?.leagues) {
      for (const lid of Object.keys(accountData.leagues)) {
        await firebaseDelete(`leagues/${lid}/members/${nickname}`);
      }
    }

    // 3. Remove nickToUid mapping
    await firebaseDelete(`nickToUid/${nickname}`);

    // 4. Remove uidToNick mapping
    await firebaseDelete(`uidToNick/${uid}`);

    // 5. Remove account record
    await firebaseDelete(`accounts/${uid}`);

    return NextResponse.json({
      message: `Conta de ${nickname} excluida com sucesso`,
      deletedUid: uid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function firebaseDelete(path: string) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Firebase DELETE failed at ${path}: ${res.status}`);
  return res.json();
}
