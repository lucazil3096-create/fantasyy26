'use client';

import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import AuthGuard from '@/components/AuthGuard';
import HomeScreen from '@/components/screens/HomeScreen';
import LineupScreen from '@/components/screens/LineupScreen';
import DraftScreen from '@/components/screens/DraftScreen';
import RankingScreen from '@/components/screens/RankingScreen';
import TradesScreen from '@/components/screens/TradesScreen';
import AdminScreen from '@/components/screens/AdminScreen';
import { useStore } from '@/store/useStore';

function AppContent() {
  const { screen } = useStore();

  const screens = {
    home: <HomeScreen />,
    lineup: <LineupScreen />,
    draft: <DraftScreen />,
    ranking: <RankingScreen />,
    trades: <TradesScreen />,
    admin: <AdminScreen />,
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-lg mx-auto pt-16 pb-20 px-4">
        {screens[screen] || <HomeScreen />}
      </main>
      <BottomNav />
    </div>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  );
}
