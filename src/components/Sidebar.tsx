'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/context/LanguageContext';
import { logoutAction } from '@/lib/actions';
import { 
  LayoutDashboard, 
  FileEdit, 
  Search, 
  BookOpen, 
  DollarSign, 
  Database, 
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Zap,
  FileBarChart,
  Shield,
  User,
  ShoppingBag,
  LogOut,
  Users,
  History
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isDemo: boolean;
  user: { username: string; role: 'OWNER' | 'STAFF'; name: string } | null;
}

export default function Sidebar({ isCollapsed, onToggle, isDemo, user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t, toast } = useLanguage();
  const role = user?.role || 'OWNER';

  const handleLogout = async () => {
    try {
      await logoutAction();
      toast(language === 'en' ? 'Logged out successfully!' : 'সফলভাবে লগআউট হয়েছেন!', 'success');
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error(e);
      toast('Logout failed', 'error');
    }
  };

  const navItems = [
    { href: '/', label: t('dashboard'), icon: LayoutDashboard, ownerOnly: true },
    { href: '/entry', label: t('backEntry'), icon: FileEdit, ownerOnly: false },
    { href: '/products', label: language === 'en' ? 'Products' : 'পণ্য তালিকা', icon: ShoppingBag, ownerOnly: false },
    { href: '/search', label: t('search'), icon: Search, ownerOnly: false },
    { href: '/ledger', label: t('ledger'), icon: BookOpen, ownerOnly: true },
    { href: '/expenses', label: t('expenses'), icon: DollarSign, ownerOnly: true },
    { href: '/reports', label: t('reports'), icon: FileBarChart, ownerOnly: true },
    { href: '/users', label: language === 'en' ? 'Staff Accounts' : 'স্টাফ অ্যাকাউন্ট', icon: Users, ownerOnly: true },
    { href: '/logs', label: language === 'en' ? 'Activity Log' : 'অডিট লগ (ক্রিয়াকলাপ)', icon: History, ownerOnly: true },
  ];

  const visibleItems = navItems.filter(item => !item.ownerOnly || role === 'OWNER');

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside 
        className={`hidden md:flex fixed inset-y-0 left-0 z-40 flex-col justify-between border-r border-neutral-850 bg-neutral-950 p-4 shadow-2xl transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-6 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-100 hover:bg-neutral-850 shadow-md transition-all active:scale-90"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        <div className="space-y-6">
          {/* Logo & Brand Header */}
          <div className={`flex items-center border-b border-neutral-900 pb-4 ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}>
            <Link href="/" className="flex items-center gap-2">
              {isCollapsed ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
                  <Zap className="h-5.5 w-5.5 fill-amber-400/20 text-amber-400" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col">
                    <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-[15px] font-black tracking-wide text-transparent font-sans leading-none">
                      Fardin
                    </span>
                    <span className="text-[9px] text-amber-500 uppercase tracking-widest font-bold mt-0.5">
                      Electricals
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-500 border border-neutral-900 rounded px-1.5 py-0.5 self-center">
                    v1.0
                  </span>
                </>
              )}
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              
              if (isCollapsed) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-250 ${
                      isActive
                        ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10 font-bold'
                        : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4.5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100'
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions & DB Status */}
        <div className="space-y-4 border-t border-neutral-900 pt-4">
          {/* User Session Profile Display */}
          {user && (
            isCollapsed ? (
              <div 
                title={`${user.name} (${user.role})`}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
                  role === 'OWNER'
                    ? 'bg-purple-950/20 border-purple-900/40 text-purple-400'
                    : 'bg-indigo-950/20 border-indigo-900/40 text-indigo-400'
                }`}
              >
                {role === 'OWNER' ? <Shield className="h-5 w-5" /> : <User className="h-5 w-5" />}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-xl border border-neutral-850 bg-neutral-900/20 p-2.5">
                <div className="flex flex-col truncate">
                  <span className="text-[10px] font-bold text-neutral-300 truncate">{user.name}</span>
                  <span className="text-[8px] text-neutral-500 uppercase tracking-widest font-semibold mt-0.5">
                    {role === 'OWNER' ? (language === 'en' ? 'Owner Account' : 'মালিক অ্যাকাউন্ট') : (language === 'en' ? 'Staff Account' : 'স্টাফ অ্যাকাউন্ট')}
                  </span>
                </div>
              </div>
            )
          )}

          {/* DB Status Badge */}
          {isCollapsed ? (
            <div 
              title={isDemo ? t('demoModeText') : t('postgresModeText')}
              className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
                isDemo
                  ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                  : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              }`}
            >
              <Database className={`h-5 w-5 ${isDemo ? 'text-amber-500' : 'text-emerald-500'}`} />
            </div>
          ) : (
            <div
              title={isDemo ? t('demoModeText') : t('postgresModeText')}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-colors ${
                isDemo
                  ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                  : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
              }`}
            >
              <Database className={`h-4 w-4 shrink-0 ${isDemo ? 'text-amber-500' : 'text-emerald-500'}`} />
              <div className="flex flex-col truncate">
                <span className="text-[9px] text-neutral-500 uppercase font-semibold">{t('activeMode')}</span>
                <span className="truncate text-neutral-200 text-[10px] font-medium mt-0.5">
                  {isDemo ? t('demoModeText') : t('postgresModeText')}
                </span>
              </div>
            </div>
          )}

          {/* Bilingual, Shortcuts, & Logout row */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-850 bg-neutral-900/40 text-xs font-bold text-neutral-200 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
                title={t('toggleLanguage')}
              >
                {language === 'en' ? 'বা' : 'EN'}
              </button>
              
              <button
                onClick={handleLogout}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-950/40 bg-rose-950/15 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 transition-colors"
                title={language === 'en' ? 'Logout' : 'লগআউট'}
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
                  className="rounded-xl border border-neutral-850 bg-neutral-900/40 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
                >
                  {t('toggleLanguage')}
                </button>

                <button
                  onClick={() => {
                    const event = new KeyboardEvent('keydown', { key: '?' });
                    window.dispatchEvent(event);
                  }}
                  className="flex items-center justify-center gap-1 rounded-xl border border-neutral-850 bg-neutral-900/40 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
                  title={t('viewShortcuts')}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>[?]</span>
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-950/50 bg-rose-950/15 hover:bg-rose-950/35 text-rose-400 hover:text-rose-300 py-2.5 text-xs font-semibold transition-all"
              >
                <LogOut className="h-4 w-4" />
                <span>{language === 'en' ? 'Log Out' : 'লগ আউট'}</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden no-print fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-850/60 bg-neutral-950/95 backdrop-blur-md py-2 flex items-center justify-around shadow-2xl">
        {visibleItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
                isActive ? 'text-amber-400' : 'text-neutral-400'
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        
        {/* Mobile Logout/Auth button */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-[10px] font-medium text-rose-400"
        >
          <LogOut className="h-4.5 w-4.5" />
          <span>{language === 'en' ? 'Logout' : 'লগআউট'}</span>
        </button>
      </div>
    </>
  );
}
