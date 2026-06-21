'use client';

import React from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface AnalyticsChartsProps {
  cashflowData: { date: string; cashIn: number; cashOut: number }[];
  topSellingData: { name: string; quantity: number }[];
}

export default function AnalyticsCharts({ cashflowData, topSellingData }: AnalyticsChartsProps) {
  const { language, t } = useLanguage();

  const formatCurrency = (value: number) => {
    return `৳${value.toLocaleString()}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/95 p-3 shadow-2xl text-xs font-mono">
          <p className="text-neutral-400 mb-1.5">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }} className="font-semibold flex justify-between gap-4">
              <span>{p.name === 'cashIn' ? t('sales') : p.name === 'cashOut' ? t('expenses') + '/' + t('purchase') : p.name}:</span>
              <span>৳{p.value.toLocaleString()}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Cashflow Chart (2/3 width) */}
      <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-emerald-500 to-indigo-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 mb-6 font-sans">
          {t('weeklyCashflow')}
        </h2>
        
        <div className="h-72 w-full">
          {cashflowData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-500">
              {language === 'en' ? 'No transactions in active range' : 'সক্রিয় রেঞ্জে কোনো লেনদেন নেই'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(v) => `৳${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle" 
                  iconSize={6}
                  formatter={(value) => (
                    <span className="text-xs font-semibold text-neutral-300">
                      {value === 'cashIn' ? (language === 'en' ? 'Cash In (Paid Invoices)' : 'ক্যাশ ইন (জমা)') : (language === 'en' ? 'Cash Out (Purchases & Expenses)' : 'ক্যাশ আউট (ক্রয় ও খরচ)')}
                    </span>
                  )}
                />
                <Area 
                  type="monotone" 
                  dataKey="cashIn" 
                  name="cashIn"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCashIn)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="cashOut" 
                  name="cashOut"
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCashOut)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top Products Chart (1/3 width) */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 mb-6 font-sans">
          {t('topSelling')}
        </h2>

        <div className="h-72 w-full">
          {topSellingData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-neutral-500">
              {language === 'en' ? 'No sales data logged yet' : 'এখনো বিক্রয় সংক্রান্ত তথ্য নেই'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={topSellingData}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  stroke="#71717a" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  width={90}
                />
                <Tooltip 
                  cursor={{ fill: '#27272a', opacity: 0.1 }}
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-2xl text-xs font-mono">
                          <p className="font-semibold text-amber-400">
                            {payload[0].value} {language === 'en' ? 'pcs sold' : 'টি বিক্রি'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="quantity" 
                  fill="#f59e0b" 
                  radius={[0, 6, 6, 0]}
                  barSize={12}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
