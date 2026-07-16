'use client';

import React, { useState, useEffect } from 'react';
import { getDashboardDataAction } from '@/lib/actions';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import DashboardShell from '@/components/DashboardShell';
import SendReminderButton from '@/components/SendReminderButton';
import { useLanguage } from '@/lib/context/LanguageContext';
import { 
  AlertOctagon, 
  AlertCircle,
  Calendar,
  User,
  FileText,
  Percent,
  Loader2
} from 'lucide-react';

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const dashboardData = await getDashboardDataAction();
        setData(dashboardData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[50vh] text-xs text-neutral-500 font-mono flex-col gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
        <span>Loading dashboard analytics...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-25 text-xs text-neutral-505">
        Failed to load dashboard data. Please make sure you are logged in.
      </div>
    );
  }

  const { 
    metrics, 
    lowStock, 
    deadStock, 
    overdueInvoices = [], 
    categoryMargins = [], 
    cashflowData, 
    topSellingData 
  } = data;

  return (
    <DashboardShell metrics={metrics}>
      
      {/* 1. OVERDUE COLLECTIONS WARNING ALERT (Top Priority) */}
      {overdueInvoices.length > 0 && (
        <div className="rounded-2xl border border-rose-900/60 bg-gradient-to-br from-rose-950/20 to-neutral-900/60 p-5 shadow-xl backdrop-blur-sm relative overflow-hidden animate-slide-in">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-rose-500/10 to-transparent blur-xl pointer-events-none" />
          
          <div className="flex items-center gap-2 text-rose-400 border-b border-rose-900/20 pb-3 mb-4">
            <AlertCircle className="h-5 w-5 text-rose-500 animate-pulse shrink-0" />
            <h2 className="text-sm font-bold uppercase tracking-wider">
              Expected Collection Alert (বাকির তাগাদা - {overdueInvoices.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-56 overflow-y-auto pr-1">
            {overdueInvoices.map((inv: any) => (
              <div 
                key={inv.id} 
                className="flex items-center justify-between p-3 rounded-xl border border-rose-950 bg-rose-950/10 text-xs hover:bg-rose-950/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-neutral-200 flex items-center gap-1">
                    <User className="h-3 w-3 text-neutral-500" />
                    {inv.partyName}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {inv.manualInvoiceNo} | <Calendar className="h-3 w-3" /> {inv.expectedPaymentDate}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-bold text-rose-400 font-mono">৳{inv.dueAmount.toFixed(2)}</span>
                    <span className="block text-[9px] uppercase tracking-wider text-rose-500/80 font-bold mt-0.5">Overdue</span>
                  </div>
                  <SendReminderButton invoiceId={inv.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Analytics Charts */}
      <AnalyticsCharts 
        cashflowData={cashflowData} 
        topSellingData={topSellingData} 
      />

      {/* 2. CATEGORY PROFITABILITY LEADERBOARD & ALERTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Category Profit Margins Panel (1/3 Width) */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-purple-500 to-indigo-500" />
          <div className="flex items-center gap-2 mb-6">
            <Percent className="h-5 w-5 text-purple-400 shrink-0" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
              Category Profit Margins
            </h2>
          </div>

          <div className="space-y-4 max-h-[360px] overflow-y-auto pr-1">
            {categoryMargins.length === 0 ? (
              <div className="text-xs text-neutral-500 py-10 text-center">
                No category sales recorded yet.
              </div>
            ) : (
              categoryMargins.map((cat: any) => {
                const margin = cat.marginPercent;
                const barColor = margin >= 30 
                  ? 'bg-emerald-500' 
                  : margin >= 15 
                  ? 'bg-amber-500' 
                  : 'bg-rose-550';

                return (
                  <div key={cat.category} className="space-y-1.5 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-neutral-300 font-semibold">{cat.category}</span>
                      <span className="font-mono text-neutral-400 flex items-center gap-1">
                        ৳{cat.profit.toLocaleString()} profit 
                        <span className="text-[10px] text-neutral-600">({margin.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-950 border border-neutral-800/40 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
                        style={{ width: `${Math.min(100, Math.max(0, margin))}%` }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low Stock Warning Panel (1/3 Width) */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-amber-500" />
          <div className="flex items-center gap-2 mb-6">
            <AlertOctagon className="h-5 w-5 text-amber-500 shrink-0" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
              Low Stock Notification
            </h2>
          </div>
          
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {lowStock.length === 0 ? (
              <div className="text-xs text-neutral-500 py-10 text-center">
                All stocks are at healthy levels.
              </div>
            ) : (
              lowStock.map((prod: any) => (
                <div 
                  key={prod.id} 
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-800/60 bg-neutral-950/40 text-xs hover:bg-neutral-950 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-neutral-200">{prod.name}</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">{prod.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-400">{prod.currentStock} pcs</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">Alert: {prod.minStockAlert} pcs</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dead Stock Warning Panel (1/3 Width) */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute left-0 top-0 h-1 w-full bg-rose-500" />
          <div className="flex items-center gap-2 mb-6">
            <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
              Dead Stock Alert
            </h2>
          </div>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {deadStock.length === 0 ? (
              <div className="text-xs text-neutral-500 py-10 text-center">
                No dead stock detected.
              </div>
            ) : (
              deadStock.map((prod: any) => (
                <div 
                  key={prod.id} 
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-800/60 bg-neutral-950/40 text-xs hover:bg-neutral-950 transition-colors"
                >
                  <div>
                    <span className="font-semibold text-neutral-200">{prod.name}</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">{prod.category}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-rose-400">{prod.currentStock} pcs</span>
                    <span className="block text-[9px] uppercase tracking-wider text-rose-500/80 font-bold mt-0.5">No Sales (60d)</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </DashboardShell>
  );
}
