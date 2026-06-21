'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { getCurrentUserAction } from '@/lib/actions';
import { Shield, Loader2 } from 'lucide-react';

export default function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ username: string; role: 'OWNER' | 'STAFF'; name: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    async function checkAuth() {
      if (pathname === '/login') {
        setCheckingAuth(false);
        return;
      }
      try {
        const activeUser = await getCurrentUserAction();
        if (!activeUser) {
          router.push('/login');
        } else {
          setUser(activeUser);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, [pathname, router]);

  const handleToggle = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const isOwnerOnlyRoute = 
    pathname === '/' || 
    pathname.startsWith('/ledger') || 
    pathname.startsWith('/expenses') || 
    pathname.startsWith('/reports') || 
    pathname.startsWith('/users') ||
    pathname.startsWith('/logs');

  const accessDenied = user?.role === 'STAFF' && isOwnerOnlyRoute;

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-neutral-950 text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-amber-500 animate-spin" />
          <span className="text-xs font-semibold tracking-widest uppercase">Loading Suite...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-neutral-950">
      {/* Sidebar Component */}
      <Sidebar 
        isCollapsed={isCollapsed} 
        onToggle={handleToggle} 
        isDemo={false} // Will display connection inside sidebar based on fallback checks
        user={user}
      />
      
      {/* Main Content Wrapper with dynamic padding */}
      <div 
        className={`flex-1 w-full transition-all duration-300 ${
          mounted 
            ? (isCollapsed ? 'md:pl-20' : 'md:pl-64') 
            : 'md:pl-64'
        }`}
      >
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 font-sans">
          {mounted && accessDenied ? (
            <div className="flex items-center justify-center min-h-[60vh] p-6 text-center">
              <div className="border border-neutral-850 rounded-2xl bg-neutral-900/30 p-8 max-w-md w-full shadow-2xl">
                <Shield className="h-10 w-10 text-purple-400 mx-auto mb-4 animate-pulse" />
                <h2 className="text-base font-bold uppercase tracking-wider text-neutral-300">Owner Access Required</h2>
                <p className="text-xs text-neutral-500 mt-2">
                  This section containing financial insights and ledger balance statements is restricted. Please switch to an Owner session to proceed.
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
