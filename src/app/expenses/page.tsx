'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { addExpenseAction, getExpensesAction } from '@/lib/actions';
import { 
  DollarSign, 
  Tag, 
  Calendar, 
  FileText, 
  Plus, 
  Layers, 
  CheckCircle 
} from 'lucide-react';

interface Expense {
  id: number;
  title: string;
  category: string;
  amount: number;
  date: string;
}

export default function ExpensesPage() {
  const { language, t, toast } = useLanguage();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Rent' | 'Utility' | 'Salary' | 'Tea-Snacks' | 'Others'>('Tea-Snacks');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set today's date as default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const list = await getExpensesAction();
      setExpenses(list as Expense[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !category || !amount || amount <= 0 || !date) {
      toast(t('allFieldsRequired'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpenseAction(title, category, amount, date);
      toast(t('successExpense'), 'success');
      
      // Reset form (except date)
      setTitle('');
      setAmount('');
      setCategory('Tea-Snacks');
      
      // Refresh list
      loadExpenses();
    } catch (err: any) {
      toast(err.message || 'Failed to log expense', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpensesAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Categories helper
  const getCategoryBadgeColor = (cat: string) => {
    switch (cat) {
      case 'Rent': return 'bg-purple-950/60 border-purple-800/80 text-purple-300';
      case 'Utility': return 'bg-cyan-950/60 border-cyan-800/80 text-cyan-300';
      case 'Salary': return 'bg-blue-950/60 border-blue-800/80 text-blue-300';
      case 'Tea-Snacks': return 'bg-amber-950/60 border-amber-800/80 text-amber-300';
      default: return 'bg-neutral-950/60 border-neutral-800/80 text-neutral-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-amber-500" />
          {t('expenses')}
        </h1>
        <p className="text-xs text-neutral-500 mt-1">
          {language === 'en' ? 'Log general operational expenses like rent, tea bills, utilities, and salary' : 'দোকান ভাড়া, চা-নাস্তা বিল, বিদ্যুৎ বিল ও কর্মচারীদের বেতনের হিসাব রাখুন'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* LEFT COLUMN: Record Expense Form */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-20 w-20 bg-rose-500/5 blur-xl pointer-events-none" />
          
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center gap-1.5">
            <Plus className="h-4.5 w-4.5" />
            {language === 'en' ? 'Log New Expense' : 'নতুন খরচ লিপিবদ্ধ করুন'}
          </h2>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {t('expenseTitle')}
              </label>
              <input
                type="text"
                required
                placeholder="e.g. June Electricity Bill"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
              />
            </div>

            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" />
                {t('expenseCategory')}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
              >
                <option value="Rent">Rent ({language === 'en' ? 'Rent' : 'দোকান ভাড়া'})</option>
                <option value="Utility">Utility ({language === 'en' ? 'Utility' : 'বিদ্যুৎ/পানি বিল'})</option>
                <option value="Salary">Salary ({language === 'en' ? 'Salary' : 'কর্মচারীর বেতন'})</option>
                <option value="Tea-Snacks">Tea-Snacks ({language === 'en' ? 'Tea-Snacks' : 'চা-নাস্তা'})</option>
                <option value="Others">Others ({language === 'en' ? 'Others' : 'অন্যান্য খরচ'})</option>
              </select>
            </div>

            {/* Amount & Date Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {t('expenseAmount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setAmount(val);
                  }}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('expenseDate')}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-3 text-sm font-semibold tracking-wider text-white shadow-lg transition-all duration-300 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('loading') : (language === 'en' ? 'Log Expense' : 'খরচ লিপিবদ্ধ করুন')}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Expenses Ledger List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary Mini-Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/20 p-5 shadow-lg backdrop-blur-sm relative overflow-hidden flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                {language === 'en' ? 'Total Period Expenses' : 'মোট দোকান খরচ'}
              </span>
              <div className="text-xl font-bold font-mono text-rose-400 mt-1">
                ৳{totalExpensesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <Layers className="h-8 w-8 text-neutral-800" />
          </div>

          {/* Expenses Table list */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm">
            {loading ? (
              <div className="text-center py-20 text-xs text-neutral-500">{t('loading')}</div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-20 text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                <CheckCircle className="h-8 w-8 text-emerald-500/60" />
                <span>{language === 'en' ? 'No expenses logged in this cycle.' : 'এই চক্রে কোনো খরচ লিপিবদ্ধ করা হয়নি।'}</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 font-semibold text-neutral-400">
                      <th className="p-3">{t('expenseTitle')}</th>
                      <th className="p-3 w-32">{t('expenseCategory')}</th>
                      <th className="p-3 w-32 font-mono">{t('expenseDate')}</th>
                      <th className="p-3 text-right w-28">{t('expenseAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-neutral-850 hover:bg-neutral-900/20 transition-colors">
                        {/* Title */}
                        <td className="p-3 font-semibold text-neutral-200">{e.title}</td>
                        
                        {/* Category */}
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide border uppercase ${getCategoryBadgeColor(e.category)}`}>
                            {e.category}
                          </span>
                        </td>
                        
                        {/* Date */}
                        <td className="p-3 font-mono text-xs text-neutral-500">{e.date}</td>
                        
                        {/* Amount */}
                        <td className="p-3 text-right font-mono text-neutral-100 font-bold">
                          ৳{e.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
