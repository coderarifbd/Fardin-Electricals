'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/lib/actions';
import { Lock, User, ShieldAlert, Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState<'en' | 'bn'>('bn');

  const t = {
    en: {
      title: 'Sign In to Fardin Electricals',
      subtitle: 'Accounting & Inventory Management Suite',
      username: 'Username',
      password: 'Password',
      signIn: 'Sign In',
      signingIn: 'Signing In...',
      demoAccounts: 'Demo Credentials:',
      owner: 'Owner',
      staff: 'Staff',
      loginErr: 'Invalid username or password',
    },
    bn: {
      title: 'ফারদিন ইলেক্ট্রিক্যালস এ সাইন-ইন',
      subtitle: 'অ্যাকাউন্টিং ও ইনভেন্টরি সফটওয়্যার',
      username: 'ইউজারনেম',
      password: 'পাসওয়ার্ড',
      signIn: 'সাইন-ইন',
      signingIn: 'সাইন-ইন হচ্ছে...',
      demoAccounts: 'ডেমো ক্রেডেনশিয়াল:',
      owner: 'মালিক (Owner)',
      staff: 'স্টাফ (Staff)',
      loginErr: 'ভুল ইউজারনেম অথবা পাসওয়ার্ড',
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);

    try {
      const res = await loginAction(username, password);
      if (res.success) {
        if (res.user.role === 'STAFF') {
          router.push('/entry');
        } else {
          router.push('/');
        }
        router.refresh();
      }
    } catch (err: any) {
      setError(language === 'bn' ? t.bn.loginErr : t.en.loginErr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 select-none overflow-hidden font-sans">
      {/* Dynamic background glow */}
      <div className="absolute right-1/4 top-1/4 h-[350px] w-[350px] bg-gradient-to-br from-amber-500/10 to-orange-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute left-1/4 bottom-1/4 h-[300px] w-[300px] bg-gradient-to-br from-purple-500/10 to-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Language Switcher */}
      <button 
        onClick={() => setLanguage(l => l === 'en' ? 'bn' : 'en')}
        className="absolute top-6 right-6 text-xs font-semibold px-3 py-1.5 border border-neutral-800 rounded-xl bg-neutral-900/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        {language === 'en' ? 'বাংলা' : 'English'}
      </button>

      <div className="w-full max-w-md space-y-6 z-10">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Zap className="h-8 w-8 fill-amber-400/20 text-amber-400" />
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-3xl font-black tracking-wider text-transparent">
            Fardin Electricals
          </h1>
          <p className="text-xs text-neutral-400 font-medium">
            {language === 'en' ? t.en.subtitle : t.bn.subtitle}
          </p>
        </div>

        {/* Card Body */}
        <div className="rounded-2xl border border-neutral-850 bg-neutral-900/35 p-8 shadow-2xl backdrop-blur-md">
          <h2 className="text-lg font-bold text-neutral-200 mb-6 text-center">
            {language === 'en' ? t.en.title : t.bn.title}
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/15 p-3 text-xs text-rose-400 font-semibold animate-pulse">
                <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 pl-1">
                <User className="h-3.5 w-3.5" />
                {language === 'en' ? t.en.username : t.bn.username}
              </label>
              <input
                type="text"
                required
                placeholder="e.g. owner or staff"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder-neutral-700 outline-none focus:border-amber-500 transition-colors font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5 pl-1">
                <Lock className="h-3.5 w-3.5" />
                {language === 'en' ? t.en.password : t.bn.password}
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder-neutral-700 outline-none focus:border-amber-500 transition-colors font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 p-3.5 text-sm font-bold text-black shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all disabled:opacity-50 select-none mt-2"
            >
              {loading 
                ? (language === 'en' ? t.en.signingIn : t.bn.signingIn) 
                : (language === 'en' ? t.en.signIn : t.bn.signIn)}
            </button>
          </form>

          {/* Seed/Demo Helper */}
          <div className="border-t border-neutral-850 mt-6 pt-5 space-y-2 text-[10px] text-neutral-500 select-text">
            <span className="font-bold uppercase tracking-wider block text-neutral-400">
              {language === 'en' ? t.en.demoAccounts : t.bn.demoAccounts}
            </span>
            <div className="flex justify-between border border-neutral-850 bg-neutral-950/40 p-2.5 rounded-xl font-mono">
              <div>
                <span className="text-amber-500/80 font-bold block">{language === 'en' ? t.en.owner : t.bn.owner}</span>
                <span>User: <strong className="text-neutral-300">owner</strong></span>
                <span className="block">Pass: <strong className="text-neutral-300">owner123</strong></span>
              </div>
              <div className="border-l border-neutral-850 pl-3">
                <span className="text-purple-500/80 font-bold block">{language === 'en' ? t.en.staff : t.bn.staff}</span>
                <span>User: <strong className="text-neutral-300">staff</strong></span>
                <span className="block">Pass: <strong className="text-neutral-300">staff123</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
