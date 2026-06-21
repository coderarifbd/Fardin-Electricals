'use client';

import React from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingBag, 
  DollarSign, 
  Layers, 
  HelpCircle,
  Shield
} from 'lucide-react';

interface DashboardShellProps {
  metrics: {
    totalSales: number;
    totalPurchases: number;
    totalExpenses: number;
    totalCogs: number;
    netProfit: number;
  };
  children: React.ReactNode;
}

export default function DashboardShell({ metrics, children }: DashboardShellProps) {
  const { language, t } = useLanguage();
  const [mounted, setMounted] = React.useState(false);
  const [isOwner, setIsOwner] = React.useState(true);

  React.useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    setIsOwner(savedRole !== 'STAFF');
    setMounted(true);
  }, []);

  if (mounted && !isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 border border-neutral-800 rounded-2xl bg-neutral-900/30">
        <Shield className="h-10 w-10 text-purple-400 mb-3 animate-pulse" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300">Access Denied</h2>
        <p className="text-xs text-neutral-500 mt-1">Owner role is required to view financial statements.</p>
      </div>
    );
  }

  const isProfitable = metrics.netProfit >= 0;

  const cardConfig = [
    {
      title: t('totalSales'),
      value: metrics.totalSales,
      icon: TrendingUp,
      color: 'text-emerald-400 border-emerald-950/60 bg-emerald-950/10',
      iconColor: 'text-emerald-500'
    },
    {
      title: t('totalPurchases'),
      value: metrics.totalPurchases,
      icon: ShoppingBag,
      color: 'text-blue-400 border-blue-950/60 bg-blue-950/10',
      iconColor: 'text-blue-500'
    },
    {
      title: t('totalExpenses'),
      value: metrics.totalExpenses,
      icon: DollarSign,
      color: 'text-rose-400 border-rose-950/60 bg-rose-950/10',
      iconColor: 'text-rose-500'
    },
    {
      title: t('cogs'),
      value: metrics.totalCogs,
      icon: Layers,
      color: 'text-neutral-300 border-neutral-800/80 bg-neutral-900/10',
      iconColor: 'text-neutral-400',
      tooltip: t('cogsTooltip')
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with profit / loss engine */}
      <div className={`relative overflow-hidden rounded-2xl border p-6 shadow-xl backdrop-blur-sm transition-all duration-300 ${
        isProfitable 
          ? 'border-emerald-800/40 bg-gradient-to-br from-emerald-950/20 to-neutral-900/60' 
          : 'border-rose-800/40 bg-gradient-to-br from-rose-950/20 to-neutral-900/60'
      }`}>
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-br from-white/5 to-transparent blur-2xl" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {t('netProfit')}
            </span>
            <div className={`text-3xl font-extrabold font-mono tracking-tight mt-1 flex items-baseline gap-1 ${
              isProfitable ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              ৳{metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs font-medium text-neutral-400 ml-1">BDT</span>
            </div>
            <p className="text-xs text-neutral-500 mt-1.5">
              Formula: Sales - (COGS + Expenses)
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isProfitable ? 'bg-emerald-950 border border-emerald-800 text-emerald-400' : 'bg-rose-950 border border-rose-800 text-rose-400'
            }`}>
              {isProfitable ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </span>
            <div className="text-left">
              <div className="text-xs font-bold text-neutral-300 uppercase">
                {isProfitable 
                  ? (language === 'en' ? 'Shop is Profitable' : 'দোকান লাভে আছে') 
                  : (language === 'en' ? 'Shop is in Deficit' : 'দোকান লোকসানে আছে')}
              </div>
              <div className="text-[10px] text-neutral-500">
                {language === 'en' ? 'Calculated on all entries' : 'সকল মোট খাতার ভিত্তিতে হিসাবকৃত'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of 4 main metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cardConfig.map((card) => {
          const Icon = card.icon;
          return (
            <div 
              key={card.title} 
              className={`rounded-2xl border p-5 shadow-lg backdrop-blur-sm transition-all hover:scale-[1.02] duration-300 ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  {card.title}
                  {card.tooltip && (
                    <span className="group relative cursor-pointer" title={card.tooltip}>
                      <HelpCircle className="h-3.5 w-3.5 text-neutral-500 hover:text-neutral-300 transition-colors" />
                    </span>
                  )}
                </span>
                <span className={`p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 ${card.iconColor}`}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
              </div>
              <div className="text-xl font-bold font-mono tracking-tight mt-3 text-neutral-100">
                ৳{card.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Render children (Charts + Alerts) */}
      {children}
    </div>
  );
}
