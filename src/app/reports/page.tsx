'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { getReportDataAction } from '@/lib/actions';
import { 
  FileBarChart, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Layers, 
  ShoppingBag, 
  Calendar, 
  FileText,
  FileSpreadsheet,
  Activity,
  Percent
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface Invoice {
  id: number;
  invoiceType: 'SALES' | 'PURCHASE';
  manualInvoiceNo: string;
  invoiceDate: string;
  partyName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
}

interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  date: string;
}

export default function ReportsPage() {
  const { language, t } = useLanguage();

  // Filter States
  const [reportType, setReportType] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(6); // Default June
  const [activeSubTab, setActiveSubTab] = useState<'LEDGER' | 'PROFIT_LOSS'>('LEDGER');

  // Data States
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    totalCogs: 0,
    netProfit: 0
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Month names
  const months = [
    { value: 1, en: 'January', bn: 'জানুয়ারি' },
    { value: 2, en: 'February', bn: 'ফেব্রুয়ারি' },
    { value: 3, en: 'March', bn: 'মার্চ' },
    { value: 4, en: 'April', bn: 'এপ্রিল' },
    { value: 5, en: 'May', bn: 'মে' },
    { value: 6, en: 'June', bn: 'জুন' },
    { value: 7, en: 'July', bn: 'জুলাই' },
    { value: 8, en: 'August', bn: 'আগস্ট' },
    { value: 9, en: 'September', bn: 'সেপ্টেম্বর' },
    { value: 10, en: 'October', bn: 'অক্টোবর' },
    { value: 11, en: 'November', bn: 'নভেম্বর' },
    { value: 12, en: 'December', bn: 'ডিসেম্বর' }
  ];

  const years = [2025, 2026, 2027];

  const loadReport = async () => {
    setLoading(true);
    try {
      const monthParam = reportType === 'MONTHLY' ? selectedMonth : undefined;
      const data = await getReportDataAction(selectedYear, monthParam);
      
      setMetrics(data.metrics);
      setInvoices(data.invoices as Invoice[]);
      setExpenses(data.expenses as Expense[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [reportType, selectedYear, selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  const isProfitable = metrics.netProfit >= 0;
  const currentMonthObj = months.find(m => m.value === selectedMonth);

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, exp) => {
    const cat = exp.category || 'Others';
    acc[cat] = (acc[cat] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseCategoriesList = Object.entries(expensesByCategory).map(([category, amount]) => ({
    category,
    amount
  }));

  const grossProfit = metrics.totalSales - metrics.totalCogs;

  // Calculate total VAT liability collected
  const totalVatCollected = invoices
    .filter(i => i.invoiceType === 'SALES')
    .reduce((sum, i) => sum + (Number((i as any).vatAmount) || 0), 0);

  // Group cashflow data dynamically for chart
  const getCashflowChartData = () => {
    const map = new Map<string, { cashIn: number; cashOut: number }>();
    
    invoices.forEach(inv => {
      const key = reportType === 'YEARLY' ? inv.invoiceDate.substring(0, 7) : inv.invoiceDate;
      if (!map.has(key)) {
        map.set(key, { cashIn: 0, cashOut: 0 });
      }
      const val = map.get(key)!;
      if (inv.invoiceType === 'SALES') {
        val.cashIn += inv.paidAmount;
      } else {
        val.cashOut += inv.paidAmount;
      }
    });

    expenses.forEach(exp => {
      const key = reportType === 'YEARLY' ? exp.date.substring(0, 7) : exp.date;
      if (!map.has(key)) {
        map.set(key, { cashIn: 0, cashOut: 0 });
      }
      const val = map.get(key)!;
      val.cashOut += exp.amount;
    });

    return Array.from(map.entries())
      .map(([period, vals]) => {
        let label = period;
        if (reportType === 'YEARLY') {
          const m = parseInt(period.split('-')[1]);
          const mObj = months.find(x => x.value === m);
          label = mObj ? (language === 'en' ? mObj.en.substring(0, 3) : mObj.bn) : period;
        }
        return {
          period: label,
          cashIn: parseFloat(vals.cashIn.toFixed(2)),
          cashOut: parseFloat(vals.cashOut.toFixed(2))
        };
      })
      .sort((a, b) => {
        if (reportType === 'YEARLY') {
          const aIndex = months.findIndex(m => (language === 'en' ? m.en.substring(0, 3) : m.bn) === a.period);
          const bIndex = months.findIndex(m => (language === 'en' ? m.en.substring(0, 3) : m.bn) === b.period);
          return aIndex - bIndex;
        }
        return a.period.localeCompare(b.period);
      });
  };

  const chartData = getCashflowChartData();

  return (
    <div className="space-y-6 font-sans">
      {/* 1. TOP CONTROL BAR (Screen Only - Hidden during print) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2 text-neutral-100">
            <FileBarChart className="h-5 w-5 text-amber-500" />
            {language === 'en' ? 'Report Center' : 'রিপোর্ট সেন্টার'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' 
              ? 'Select period, generate statements, and export/print high-fidelity reports' 
              : 'সময় নির্বাচন করুন, হিসাব বিবরণী জেনারেট করুন এবং প্রিন্ট/পিডিএফ করুন'}
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Monthly / Yearly toggle */}
          <div className="flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1">
            <button
              onClick={() => setReportType('MONTHLY')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                reportType === 'MONTHLY'
                  ? 'bg-amber-500 text-black'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {language === 'en' ? 'Monthly' : 'মাসিক'}
            </button>
            <button
              onClick={() => setReportType('YEARLY')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                reportType === 'YEARLY'
                  ? 'bg-amber-500 text-black'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {language === 'en' ? 'Yearly' : 'বার্ষিক'}
            </button>
          </div>

          {/* Month selector dropdown */}
          {reportType === 'MONTHLY' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 outline-none focus:border-amber-500 cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {language === 'en' ? m.en : m.bn}
                </option>
              ))}
            </select>
          )}

          {/* Year selector dropdown */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-200 outline-none focus:border-amber-500 cursor-pointer"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-black shadow-md transition-colors select-none"
          >
            <Printer className="h-4 w-4" />
            {language === 'en' ? 'Print Statement' : 'প্রিন্ট করুন'}
          </button>
        </div>
      </div>

      {/* SUB-TABS (LEDGER VS NET PROFIT STATEMENT) - Screen Only */}
      <div className="flex gap-2.5 no-print border-b border-neutral-900 pb-3 select-none">
        <button
          onClick={() => setActiveSubTab('LEDGER')}
          className={`flex items-center gap-1.5 border px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'LEDGER'
              ? 'bg-neutral-900 border-amber-500/40 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {language === 'en' ? 'Itemized Ledger Report' : 'ইনভয়েস ও খরচ লেজার'}
        </button>

        <button
          onClick={() => setActiveSubTab('PROFIT_LOSS')}
          className={`flex items-center gap-1.5 border px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeSubTab === 'PROFIT_LOSS'
              ? 'bg-neutral-900 border-amber-500/40 text-amber-400'
              : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Activity className="h-4 w-4" />
          {language === 'en' ? 'Net Profit Statement' : ' লাভ-ক্ষতি বিবরণী (P&L)'}
        </button>
      </div>

      {/* 2. REPORT STYLING CONTAINER (Optimized for both screen and printing) */}
      {loading ? (
        <div className="text-center py-20 text-xs text-neutral-500 no-print">{t('loading')}</div>
      ) : (
        <div className="print-card rounded-2xl border border-neutral-800 bg-neutral-900/20 p-6 md:p-8 shadow-xl backdrop-blur-sm space-y-8">
          
          {/* Print specific statement header */}
          <div className="border-b print-border-clean border-neutral-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500 font-mono">
                {activeSubTab === 'PROFIT_LOSS' 
                  ? (language === 'en' ? 'INCOME STATEMENT (P&L)' : 'লাভ-ক্ষতি হিসাব বিবরণী') 
                  : (language === 'en' ? 'STATEMENT OF ACCOUNT' : 'হিসাব বিবরণী')}
              </span>
              <h2 className="text-2xl font-bold tracking-tight mt-1 print-text-dark text-neutral-100">
                {language === 'en' ? 'Fardin Electricals Statement' : 'ফারদিন ইলেক্ট্রিক্যালস হিসাব বিবরণী'}
              </h2>
              <p className="text-xs text-neutral-500 mt-1 font-mono">
                {language === 'en' ? 'Period: ' : 'সময়সীমা: '}
                <span className="font-semibold text-neutral-300 print-text-dark">
                  {reportType === 'MONTHLY' 
                    ? `${language === 'en' ? currentMonthObj?.en : currentMonthObj?.bn}, ${selectedYear}`
                    : `${selectedYear}`}
                </span>
              </p>
            </div>
            
            <div className="text-left md:text-right font-mono text-[10px] text-neutral-500">
              <div>{language === 'en' ? 'Generated on: ' : 'প্রস্তুতকাল: '}{new Date().toLocaleDateString()}</div>
              <div>{language === 'en' ? 'Format: A4 Statement' : 'ফরমেট: A4 স্টেটমেন্ট'}</div>
            </div>
          </div>

          {activeSubTab === 'LEDGER' ? (
            <>
              {/* Financial summary blocks */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 print-text-dark">
                  {language === 'en' ? 'Financial Position' : 'আর্থিক পরিস্থিতি সারসংক্ষেপ'}
                </h3>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Sales card */}
                  <div className="print-card rounded-xl border border-neutral-850 bg-neutral-950/20 p-4">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">{t('totalSales')}</span>
                    <div className="text-base font-bold font-mono text-emerald-400 print-text-dark mt-1">
                      ৳{metrics.totalSales.toFixed(2)}
                    </div>
                  </div>

                  {/* Purchase card */}
                  <div className="print-card rounded-xl border border-neutral-850 bg-neutral-950/20 p-4">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">{t('totalPurchases')}</span>
                    <div className="text-base font-bold font-mono text-blue-400 print-text-dark mt-1">
                      ৳{metrics.totalPurchases.toFixed(2)}
                    </div>
                  </div>

                  {/* Expenses card */}
                  <div className="print-card rounded-xl border border-neutral-850 bg-neutral-950/20 p-4">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">{t('totalExpenses')}</span>
                    <div className="text-base font-bold font-mono text-rose-400 print-text-dark mt-1">
                      ৳{metrics.totalExpenses.toFixed(2)}
                    </div>
                  </div>

                  {/* COGS card */}
                  <div className="print-card rounded-xl border border-neutral-850 bg-neutral-950/20 p-4">
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">{language === 'en' ? 'COGS' : 'বিক্রিত মালের ক্রয়ব্যয় (COGS)'}</span>
                    <div className="text-base font-bold font-mono text-neutral-350 print-text-dark mt-1">
                      ৳{metrics.totalCogs.toFixed(2)}
                    </div>
                  </div>

                  {/* Net Profit Card */}
                  <div className={`print-card col-span-2 md:col-span-1 rounded-xl border p-4 ${
                    isProfitable 
                      ? 'border-emerald-800/40 bg-emerald-950/10 text-emerald-400' 
                      : 'border-rose-800/40 bg-rose-950/10 text-rose-400'
                  }`}>
                    <span className="text-[10px] text-neutral-500 uppercase font-semibold">{t('netProfit')}</span>
                    <div className={`text-base font-bold font-mono print-text-dark mt-1 flex items-center gap-1`}>
                      ৳{metrics.netProfit.toFixed(2)}
                      {isProfitable ? <TrendingUp className="h-4 w-4 shrink-0 no-print" /> : <TrendingDown className="h-4 w-4 shrink-0 no-print" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Cashflow Chart Card */}
              {chartData.length > 0 && (
                <div className="rounded-xl border border-neutral-850 bg-neutral-950/20 p-5 shadow-lg no-print">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-450 mb-4 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    {language === 'en' ? 'Cash Flow Analysis' : 'ক্যাশ ফ্লো চার্ট (আয় বনাম ব্যয়)'}
                  </h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                          </linearGradient>
                          <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="period" stroke="#71717a" fontSize={10} tickLine={false} />
                        <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                          labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '11px' }}
                          itemStyle={{ fontSize: '11px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        <Area 
                          type="monotone" 
                          name={language === 'en' ? 'Cash Inflow (Paid Sales)' : 'ক্যাশ ইন (বিক্রয় জমা)'} 
                          dataKey="cashIn" 
                          stroke="#10b981" 
                          fillOpacity={1} 
                          fill="url(#colorCashIn)" 
                          strokeWidth={2}
                        />
                        <Area 
                          type="monotone" 
                          name={language === 'en' ? 'Cash Outflow (Purchases & Expenses)' : 'ক্যাশ আউট (ক্রয় ও খরচ)'} 
                          dataKey="cashOut" 
                          stroke="#ef4444" 
                          fillOpacity={1} 
                          fill="url(#colorCashOut)" 
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ITEMISED INVOICES REPORT */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 print-text-dark">
                  {language === 'en' ? 'Itemized Invoices Ledger' : 'ইনভয়েস বিবরণী তালিকা'}
                </h3>
                
                <div className="print-card border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/60 font-semibold text-neutral-400 print-border-clean">
                        <th className="p-3 w-28 font-mono">{t('invoiceDate')}</th>
                        <th className="p-3 w-24">{language === 'en' ? 'Type' : 'ধরন'}</th>
                        <th className="p-3 w-28 font-mono">{t('invoiceNo')}</th>
                        <th className="p-3">{t('partyName')}</th>
                        <th className="p-3 text-right w-28">{t('totalAmount')}</th>
                        <th className="p-3 text-right w-28">{t('paidAmount')}</th>
                        <th className="p-3 text-right w-28">{t('dueAmount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-neutral-600">No invoices logged in this period.</td>
                        </tr>
                      ) : (
                        invoices.map((inv) => {
                          const isSales = inv.invoiceType === 'SALES';
                          return (
                            <tr key={inv.id} className="border-b border-neutral-800/40 print-border-clean hover:bg-neutral-900/10">
                              <td className="p-3 font-mono text-neutral-400 print-text-dark">{inv.invoiceDate}</td>
                              <td className={`p-3 font-semibold uppercase ${isSales ? 'text-emerald-400' : 'text-blue-400'} print-text-dark`}>
                                {isSales ? t('sales') : t('purchase')}
                              </td>
                              <td className="p-3 font-mono text-neutral-400 print-text-dark">{inv.manualInvoiceNo}</td>
                              <td className="p-3 text-neutral-200 print-text-dark font-medium">{inv.partyName}</td>
                              <td className="p-3 text-right font-mono text-neutral-300 print-text-dark">৳{inv.totalAmount.toFixed(2)}</td>
                              <td className="p-3 text-right font-mono text-emerald-500/80 print-text-dark">৳{inv.paidAmount.toFixed(2)}</td>
                              <td className={`p-3 text-right font-mono font-semibold print-text-dark ${inv.dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                ৳{inv.dueAmount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ITEMISED EXPENSES REPORT */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 print-text-dark">
                  {language === 'en' ? 'Itemized Expenses Ledger' : 'দোকান খরচ বিবরণী তালিকা'}
                </h3>
                
                <div className="print-card border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-950/60 font-semibold text-neutral-400 print-border-clean">
                        <th className="p-3 w-28 font-mono">{t('expenseDate')}</th>
                        <th className="p-3">{t('expenseTitle')}</th>
                        <th className="p-3 w-36">{t('expenseCategory')}</th>
                        <th className="p-3 text-right w-36">{t('expenseAmount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-neutral-600">No expenses logged in this period.</td>
                        </tr>
                      ) : (
                        expenses.map((exp) => (
                          <tr key={exp.id} className="border-b border-neutral-800/40 print-border-clean hover:bg-neutral-900/10">
                            <td className="p-3 font-mono text-neutral-400 print-text-dark">{exp.date}</td>
                            <td className="p-3 text-neutral-200 print-text-dark font-medium">{exp.title}</td>
                            <td className="p-3 text-neutral-400 print-text-dark uppercase font-semibold text-[10px]">{exp.category}</td>
                            <td className="p-3 text-right font-mono text-rose-400 print-text-dark font-bold">৳{exp.amount.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            /* NET PROFIT AND LOSS INCOME STATEMENT */
            <div className="space-y-6 max-w-2xl mx-auto border border-neutral-800/80 bg-neutral-950/45 p-6 md:p-8 rounded-2xl print-card print-border-none print-bg-transparent">
              <h3 className="text-center font-bold text-sm uppercase tracking-widest text-neutral-200 border-b border-neutral-800 pb-3 mb-6 print-text-dark">
                {language === 'en' ? 'Income Statement (P&L)' : 'লাভ-ক্ষতি হিসাব বিবরণী'}
              </h3>

              <div className="space-y-6 text-xs text-neutral-300 print-text-dark">
                {/* 1. Revenue */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-neutral-200 border-b border-neutral-850 pb-1.5">
                    <span>{language === 'en' ? 'Sales Revenue' : 'বিক্রয় রাজস্ব (আয়)'}</span>
                    <span className="font-mono">৳{metrics.totalSales.toFixed(2)}</span>
                  </div>
                  <div className="pl-4 flex justify-between text-neutral-400">
                    <span>{language === 'en' ? 'Gross Sales Invoices' : 'মোট বিক্রয় ইনভয়েস'}</span>
                    <span className="font-mono">৳{metrics.totalSales.toFixed(2)}</span>
                  </div>
                </div>

                {/* 2. Cost of Sales */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-neutral-200 border-b border-neutral-850 pb-1.5">
                    <span>{language === 'en' ? 'Cost of Goods Sold (COGS)' : 'বিক্রিত পণ্যের ক্রয়ব্যয় (COGS)'}</span>
                    <span className="font-mono text-rose-400">৳{metrics.totalCogs.toFixed(2)}</span>
                  </div>
                  <div className="pl-4 flex justify-between text-neutral-400">
                    <span>{language === 'en' ? 'Product Cost at moving average' : 'পণ্যের গড় ক্রয়মূল্য ভিত্তিক খরচ'}</span>
                    <span className="font-mono">৳{metrics.totalCogs.toFixed(2)}</span>
                  </div>
                </div>

                {/* 3. Gross Profit */}
                <div className="flex justify-between font-extrabold text-neutral-100 border-b-2 border-neutral-800 pb-2 text-sm">
                  <span>{language === 'en' ? 'Gross Profit' : 'মোট মুনাফা (Gross Profit)'}</span>
                  <span className="font-mono text-emerald-400">৳{grossProfit.toFixed(2)}</span>
                </div>

                {/* 4. Operating Expenses */}
                <div className="space-y-3">
                  <div className="flex justify-between font-bold text-neutral-200 border-b border-neutral-850 pb-1.5">
                    <span>{language === 'en' ? 'Operating Expenses' : 'দোকান পরিচালনা খরচ (Expenses)'}</span>
                    <span className="font-mono text-rose-400">৳{metrics.totalExpenses.toFixed(2)}</span>
                  </div>
                  {expenseCategoriesList.length === 0 ? (
                    <div className="pl-4 text-neutral-500 italic">No expenses logged.</div>
                  ) : (
                    expenseCategoriesList.map((ec) => (
                      <div key={ec.category} className="pl-4 flex justify-between text-neutral-400 uppercase text-[10px] font-semibold">
                        <span>{ec.category}</span>
                        <span className="font-mono">৳{ec.amount.toFixed(2)}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* VAT collected */}
                <div className="space-y-2 border-t border-neutral-800/40 pt-2.5">
                  <div className="flex justify-between font-bold text-neutral-200">
                    <span>{language === 'en' ? 'Tax/VAT Liabilities Collected' : 'সংগৃহীত ভ্যাট দায় (VAT collected)'}</span>
                    <span className="font-mono text-amber-550">৳{totalVatCollected.toFixed(2)}</span>
                  </div>
                  <div className="pl-4 text-neutral-500 text-[10px] italic">
                    <span>{language === 'en' ? 'Note: VAT collected is a balance sheet liability, not operating income.' : 'দ্রষ্টব্য: সংগৃহীত ভ্যাট একটি লাইবিলিটি বা দায়, এটি কোম্পানির নিট আয় হিসেবে গণ্য নয়।'}</span>
                  </div>
                </div>

                {/* 5. Net Income */}
                <div className={`flex justify-between font-black border-t-2 border-b-4 border-neutral-800 py-3 text-sm ${
                  isProfitable ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  <span>{language === 'en' ? 'NET PROFIT / LOSS' : 'চূড়ান্ত নিট লাভ / ক্ষতি (Net Profit)'}</span>
                  <span className="font-mono text-base">৳{metrics.netProfit.toFixed(2)}</span>
                </div>
              </div>

              {/* Signature Area (Print only) */}
              <div className="hidden print:flex justify-between items-center mt-20 pt-10 text-[10px] text-zinc-500 font-mono">
                <div className="text-center w-36 border-t border-dashed border-zinc-400 pt-1.5">
                  {language === 'en' ? 'Prepared By' : 'প্রস্তুতকারী'}
                </div>
                <div className="text-center w-36 border-t border-dashed border-zinc-400 pt-1.5 font-bold">
                  {language === 'en' ? 'Proprietor Signature' : 'স্বত্বাধিকারীর স্বাক্ষর'}
                </div>
              </div>
            </div>
          )}

          {/* Signature lines for general reports */}
          {activeSubTab === 'LEDGER' && (
            <div className="hidden print:flex justify-between items-center mt-20 pt-10 text-[10px] text-zinc-500 font-mono">
              <div className="text-center w-36 border-t border-dashed border-zinc-400 pt-1.5">
                {language === 'en' ? 'Prepared By' : 'প্রস্তুতকারী'}
              </div>
              <div className="text-center w-36 border-t border-dashed border-zinc-400 pt-1.5 font-bold">
                {language === 'en' ? 'Verified By' : 'যাচাইকারী'}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
