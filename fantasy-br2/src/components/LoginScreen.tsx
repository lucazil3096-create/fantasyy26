'use client';

import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';

export default function LoginScreen() {
  const { appearance } = useStore();
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
        const nick = nickname.toLowerCase().trim();
        if (nick.length < 3 || nick.length > 20) {
          setError('Nickname deve ter entre 3 e 20 caracteres.');
          setLoading(false);
          return;
        }
        if (!/^[a-z0-9_]+$/.test(nick)) {
          setError('Nickname so pode ter letras, numeros e _');
          setLoading(false);
          return;
        }

        // Create auth first (email = nick@fbr2.app, so nick uniqueness = email uniqueness)
        const cred = await createUserWithEmailAndPassword(auth, email, password);

        // Now we're authenticated, safe to write to DB
        await set(ref(db, `nickToUid/${nick}`), cred.user.uid);
        await set(ref(db, `uidToNick/${cred.user.uid}`), nick);
        await set(ref(db, `accounts/${cred.user.uid}`), {
          nickname: nick,
          createdAt: new Date().toISOString(),
          leagues: {},
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      console.error('Auth error:', firebaseErr.code, firebaseErr.message);
      if (firebaseErr.code === 'auth/user-not-found' || firebaseErr.code === 'auth/invalid-credential') {
        setError('Nickname ou senha incorretos. Se e novo, clique em "Criar conta".');
      } else if (firebaseErr.code === 'auth/email-already-in-use') {
        setError('Esse nickname ja esta em uso. Tente fazer login.');
      } else if (firebaseErr.code === 'auth/weak-password') {
        setError('Senha deve ter pelo menos 6 caracteres.');
      } else {
        setError(`Erro: ${firebaseErr.code || 'desconhecido'}. Tente novamente.`);
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
          {appearance.logoUrl ? (
            <img src={appearance.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl object-cover mb-3" />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-white text-3xl mb-3"
              style={{ backgroundColor: appearance.primaryColor }}
            >
              {appearance.logoText}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">{appearance.siteName}</h1>
          <p className="text-zinc-500 text-sm mt-1">{appearance.leagueName} {appearance.seasonYear}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">Nickname</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="seu_nickname"
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
          onClick={() => { setIsRegister(!isRegister); setError(''); }}
          className="w-full mt-4 text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {isRegister ? 'Ja tem conta? Entrar' : 'Novo aqui? Criar conta'}
        </button>
      </div>
    </div>
  );
}
