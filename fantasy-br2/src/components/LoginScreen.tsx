'use client';

import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, db } from '@/lib/firebase';

export default function LoginScreen() {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const email = `${nickname.toLowerCase().trim()}@fbr2.app`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nickname.trim() || !password.trim()) return;

    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        // Check if nickname is taken
        const existingSnap = await get(ref(db, `nickToUid/${nickname.toLowerCase().trim()}`));
        if (existingSnap.exists()) {
          setError('Esse nickname ja esta em uso.');
          setLoading(false);
          return;
        }

        // Create account
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Save mappings
        await set(ref(db, `nickToUid/${nickname.toLowerCase().trim()}`), cred.user.uid);
        await set(ref(db, `uidToNick/${cred.user.uid}`), nickname.toLowerCase().trim());

        // Create initial user data
        await set(ref(db, `users/${nickname.toLowerCase().trim()}`), {
          nickname: nickname.toLowerCase().trim(),
          team: [],
          formation: '4-3-3',
          budget: 100,
          totalPoints: 0,
          createdAt: new Date().toISOString(),
        });
      } else {
        // Login
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string };
      if (firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/invalid-credential') {
        setError('Nickname ou senha incorretos.');
      } else if (firebaseErr.code === 'auth/email-already-in-use') {
        setError('Esse nickname ja esta em uso.');
      } else if (firebaseErr.code === 'auth/weak-password') {
        setError('Senha deve ter pelo menos 6 caracteres.');
      } else {
        setError('Erro ao entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center font-bold text-white text-2xl mb-3">
            FB
          </div>
          <h1 className="text-2xl font-bold text-white">Fantasy BR</h1>
          <p className="text-zinc-500 text-sm mt-1">Brasileirao 2026</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Seu nickname"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !nickname.trim() || !password.trim()}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Aguarde...' : isRegister ? 'Criar Conta' : 'Entrar'}
          </button>
        </form>

        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setError('');
          }}
          className="w-full mt-4 text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isRegister ? 'Ja tem conta? Entrar' : 'Novo aqui? Criar conta'}
        </button>
      </div>
    </div>
  );
}
