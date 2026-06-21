'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { getAuditLogsAction } from '@/lib/actions';
import { 
  History, 
  Search, 
  RefreshCw, 
  User, 
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';

interface AuditLogItem {
  id: number;
  username: string;
  action: string;
  details: string;
  timestamp: string;
}

export default function LogsPage() {
  const { language, toast } = useLanguage();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogsAction();
      setLogs(data as AuditLogItem[]);
    } catch (err: any) {
      console.error(err);
      toast(language === 'en' ? 'Failed to fetch activity logs' : 'অডিট লগ লোড করতে ব্যর্থ হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Extract unique users for filtering
  const uniqueUsers = Array.from(new Set(logs.map(log => log.username)));

  // Extract unique action types for filtering
  const uniqueActions = Array.from(new Set(logs.map(log => log.action)));

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesUser = userFilter === '' || log.username === userFilter;
    const matchesAction = actionFilter === '' || log.action === actionFilter;

    return matchesSearch && matchesUser && matchesAction;
  });

  // Action badge colors helper
  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
        return 'bg-emerald-950/40 border-emerald-900/50 text-emerald-450';
      case 'USER_CREATED':
      case 'USER_PASSWORD_RESET':
        return 'bg-purple-950/40 border-purple-900/50 text-purple-400';
      case 'INVOICE_CREATED':
        return 'bg-blue-950/40 border-blue-900/50 text-blue-400';
      case 'INVOICE_UPDATED':
      case 'PAYMENT_RECORDED':
        return 'bg-amber-950/40 border-amber-900/50 text-amber-400';
      case 'INVOICE_DELETED':
        return 'bg-rose-950/40 border-rose-900/50 text-rose-455';
      case 'RETURN_PROCESSED':
        return 'bg-indigo-950/40 border-indigo-900/50 text-indigo-400';
      default:
        return 'bg-neutral-900/55 border-neutral-800 text-neutral-450';
    }
  };

  const getActionLabel = (action: string) => {
    if (language === 'en') return action;
    switch (action) {
      case 'USER_LOGIN': return 'লগইন (Login)';
      case 'USER_CREATED': return 'নতুন অ্যাকাউন্ট (Created)';
      case 'USER_PASSWORD_RESET': return 'পাসওয়ার্ড পরিবর্তন (Reset)';
      case 'INVOICE_CREATED': return 'ইনভয়েস তৈরি (Sale/Purchase)';
      case 'INVOICE_UPDATED': return 'ইনভয়েস সংশোধন (Edit)';
      case 'INVOICE_DELETED': return 'ইনভয়েস মুছে ফেলা (Delete)';
      case 'PAYMENT_RECORDED': return 'পেমেন্ট জমা (Payment)';
      case 'RETURN_PROCESSED': return 'মাল ফেরত (Return)';
      default: return action;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
            <History className="h-5 w-5 text-amber-500" />
            {language === 'en' ? 'Activity Audit Logs' : 'ক্রিয়াকলাপের বিবরণী (অডিট লগ)'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' 
              ? 'Real-time record of all administrative and financial actions taken by users.' 
              : 'স্টাফ ও মডারেটরদের দ্বারা সম্পাদিত সমস্ত প্রশাসনিক ও আর্থিক লেনদেনের সময়ভিত্তিক অডিট রেকর্ড।'}
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 self-start sm:self-center rounded-xl border border-neutral-805 hover:border-amber-500/50 bg-neutral-950 hover:bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-neutral-400 hover:text-amber-500 transition-all select-none cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {language === 'en' ? 'Refresh' : 'রিফ্রেশ করুন'}
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-900/20 border border-neutral-850/60 rounded-2xl p-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder={language === 'en' ? 'Search logs details...' : 'বিবরণ বা ইউজারনেম দিয়ে খুঁজুন...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-850 bg-neutral-950 p-3 pl-10 text-xs text-neutral-200 outline-none focus:border-amber-500 transition-colors"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
        </div>

        {/* User filter */}
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="w-full rounded-xl border border-neutral-850 bg-neutral-950 p-3 text-xs text-neutral-350 outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="">
            {language === 'en' ? 'All Users (সব অ্যাকাউন্ট)' : 'সব ব্যবহারকারী'}
          </option>
          {uniqueUsers.map(u => (
            <option key={u} value={u}>@{u}</option>
          ))}
        </select>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="w-full rounded-xl border border-neutral-850 bg-neutral-950 p-3 text-xs text-neutral-350 outline-none focus:border-amber-500 cursor-pointer"
        >
          <option value="">
            {language === 'en' ? 'All Actions (সব কার্যকলাপ)' : 'সব ধরণের কার্যকলাপ'}
          </option>
          {uniqueActions.map(act => (
            <option key={act} value={act}>{getActionLabel(act)}</option>
          ))}
        </select>
      </div>

      {/* Logs Table Area */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-450 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-4 px-5">{language === 'en' ? 'Timestamp' : 'তারিখ ও সময়'}</th>
                <th className="py-4 px-5">{language === 'en' ? 'Account' : 'ব্যবহারকারী'}</th>
                <th className="py-4 px-5">{language === 'en' ? 'Action' : 'কার্যক্রম'}</th>
                <th className="py-4 px-5">{language === 'en' ? 'Details' : 'বিস্তারিত বিবরণ'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-neutral-500 font-medium">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-amber-500/80 mb-2" />
                    {language === 'en' ? 'Loading audit records...' : 'অডিট ডাটা লোড হচ্ছে...'}
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-neutral-500 font-medium">
                    <AlertCircle className="h-5 w-5 mx-auto text-neutral-600 mb-2" />
                    {language === 'en' ? 'No activity logs match the criteria.' : 'কোন অডিট রেকর্ড পাওয়া যায়নি।'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-900/20 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-5 text-neutral-400 whitespace-nowrap font-mono text-[11px]">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-neutral-600" />
                        {new Date(log.timestamp).toLocaleString(language === 'en' ? 'en-US' : 'bn-BD', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Username */}
                    <td className="py-3.5 px-5 font-medium">
                      <div className="flex items-center gap-1.5">
                        <div className="h-5.5 w-5.5 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                          <User className="h-3 w-3" />
                        </div>
                        <span className="text-neutral-250 font-mono">@{log.username}</span>
                      </div>
                    </td>

                    {/* Action Badge */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${getActionBadgeColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>

                    {/* Details Description */}
                    <td className="py-3.5 px-5 text-neutral-300 max-w-sm sm:max-w-md font-sans leading-relaxed">
                      <div className="flex items-start gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-neutral-650 mt-0.5 shrink-0" />
                        <span>{log.details}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div className="bg-neutral-950/40 px-5 py-3 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500 font-medium">
          <div>
            {language === 'en' 
              ? `Showing ${filteredLogs.length} of ${logs.length} entries` 
              : `মোট ${logs.length} টির মধ্যে ${filteredLogs.length} টি রেকর্ড প্রদর্শিত হচ্ছে`}
          </div>
          <div className="font-mono text-neutral-650">
            {language === 'en' ? 'Showing last 100 events' : 'সর্বশেষ ১০০টি কার্যক্রম প্রদর্শিত'}
          </div>
        </div>
      </div>
    </div>
  );
}
