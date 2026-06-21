'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { getInvoicesAction, recordPaymentAction, getPartiesAction, sendSmsReminderAction } from '@/lib/actions';
import { 
  BookOpen, 
  User, 
  Calendar, 
  FileText, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  X,
  Phone,
  MapPin,
  MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';

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

interface Party {
  id: number;
  name: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  phone?: string | null;
  address?: string | null;
  currentBalance: number;
}

export default function LedgerPage() {
  const { language, t, toast } = useLanguage();
  const [activeTab, setActiveTab] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSmsId, setSendingSmsId] = useState<number | null>(null);

  // Payment Recording Modal State
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    invoice: Invoice | null;
    amount: number | '';
  }>({
    isOpen: false,
    invoice: null,
    amount: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Invoices & Parties
  const loadLedger = async () => {
    setLoading(true);
    try {
      const list = await getInvoicesAction();
      setInvoices(list.filter(i => i.dueAmount > 0) as Invoice[]);

      const plist = await getPartiesAction(activeTab);
      setParties(plist as Party[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
  }, [activeTab]);

  const customerDues = invoices.filter(i => i.invoiceType === 'SALES');
  const supplierPayables = invoices.filter(i => i.invoiceType === 'PURCHASE');

  const handleRecordPaymentClick = (invoice: Invoice) => {
    setPaymentModal({
      isOpen: true,
      invoice,
      amount: invoice.dueAmount
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { invoice, amount } = paymentModal;

    if (!invoice || !amount || amount <= 0) {
      toast(t('allFieldsRequired'), 'error');
      return;
    }

    if (amount > invoice.dueAmount) {
      toast(language === 'en' ? 'Payment amount cannot exceed due amount' : 'পরিশোধের পরিমাণ বাকি টাকার বেশি হতে পারবে না', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordPaymentAction(invoice.id, amount);
      
      confetti({
        particleCount: 80,
        spread: 50,
        origin: { y: 0.6 }
      });

      toast(t('successPayment'), 'success');
      setPaymentModal({ isOpen: false, invoice: null, amount: '' });
      loadLedger(); // Refresh
    } catch (err: any) {
      toast(err.message || 'Payment update failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSms = async (invoiceId: number) => {
    setSendingSmsId(invoiceId);
    try {
      const res = await sendSmsReminderAction(invoiceId);
      if (res.success) {
        toast(res.message, 'success');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to send SMS reminder', 'error');
    } finally {
      setSendingSmsId(null);
    }
  };

  const activeList = activeTab === 'CUSTOMER' ? customerDues : supplierPayables;

  // Aggregate totals
  const totalCustomerDues = customerDues.reduce((sum, i) => sum + i.dueAmount, 0);
  const totalSupplierPayables = supplierPayables.reduce((sum, i) => sum + i.dueAmount, 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2 text-neutral-100">
            <BookOpen className="h-5 w-5 text-amber-500" />
            {t('ledger')}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' ? 'Keep track of outstanding credits and vendor payables' : 'খাতায় কাস্টমারের বাকি ও মহাজন পাওনার হিসাব রাখুন'}
          </p>
        </div>

        {/* Tab Selector switcher */}
        <div className="flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1 self-start select-none">
          <button
            onClick={() => setActiveTab('CUSTOMER')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'CUSTOMER'
                ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t('customerDues')}
          </button>
          <button
            onClick={() => setActiveTab('SUPPLIER')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'SUPPLIER'
                ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t('supplierPayables')}
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Dues summary card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/20 p-5 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 h-20 w-20 bg-amber-500/5 blur-xl" />
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {language === 'en' ? 'Total Customer Dues (Receivable)' : 'মোট কাস্টমার বাকি (পাওনা)'}
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">
            ৳{totalCustomerDues.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Supplier Payables summary card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/20 p-5 shadow-lg backdrop-blur-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 h-20 w-20 bg-rose-500/5 blur-xl" />
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {language === 'en' ? 'Total Supplier Payables (Debt)' : 'মোট মহাজন পাওনা (দেনা)'}
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-2">
            ৳{totalSupplierPayables.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Parties Directory Section */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 pl-1">
          {activeTab === 'CUSTOMER' 
            ? (language === 'en' ? 'Customer Profile Directory' : 'কাস্টমার প্রোফাইল ডিরেক্টরি') 
            : (language === 'en' ? 'Supplier Profile Directory' : 'মহাজন প্রোফাইল ডিরেক্টরি')}
        </h2>
        {loading ? (
          <div className="text-center py-6 text-neutral-600 text-xs">{t('loading')}</div>
        ) : parties.length === 0 ? (
          <div className="text-center py-6 text-neutral-600 text-xs border border-dashed border-neutral-800 rounded-xl">
            {language === 'en' ? 'No profiles found.' : 'কোনো প্রোফাইল পাওয়া যায়নি।'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {parties.map((p) => (
              <div 
                key={p.id}
                className="rounded-xl border border-neutral-850 bg-neutral-900/30 p-4 space-y-2 hover:border-neutral-800 transition-colors"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-neutral-200 text-xs">{p.name}</span>
                  <span className={`font-mono text-xs font-bold ${
                    p.currentBalance > 0 
                      ? 'text-amber-500' 
                      : p.currentBalance < 0 
                      ? 'text-rose-500' 
                      : 'text-emerald-500'
                  }`}>
                    ৳{Math.abs(p.currentBalance).toFixed(2)}
                  </span>
                </div>
                
                <div className="space-y-1 text-[10px] text-neutral-500">
                  {p.phone && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="h-3 w-3 text-neutral-650" />
                      <span>{p.phone}</span>
                    </div>
                  )}
                  {p.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-neutral-650" />
                      <span className="truncate">{p.address}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ledger list */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl backdrop-blur-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 pl-1 mb-4">
          {language === 'en' ? 'Active Due Invoices Breakdown' : 'বকেয়া ইনভয়েসের তালিকা'}
        </h2>
        {loading ? (
          <div className="text-center py-20 text-xs text-neutral-500">{t('loading')}</div>
        ) : activeList.length === 0 ? (
          <div className="text-center py-20 text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
            <CheckCircle className="h-8 w-8 text-emerald-500/60 animate-bounce" />
            <span>
              {activeTab === 'CUSTOMER'
                ? (language === 'en' ? 'All customer dues are fully cleared!' : 'সব কাস্টমারের খাতা পরিশোধিত!')
                : (language === 'en' ? 'All supplier dues are fully settled!' : 'সব মহাজন পাওনা পরিশোধিত!')}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-850 font-semibold text-neutral-400">
                  <th className="p-3">{t('partyName')}</th>
                  <th className="p-3 w-32">{t('invoiceNo')}</th>
                  <th className="p-3 w-32">{t('invoiceDate')}</th>
                  <th className="p-3 text-right w-32">{t('totalAmount')}</th>
                  <th className="p-3 text-right w-32">{t('paidAmount')}</th>
                  <th className="p-3 text-right w-32">{t('dueAmount')}</th>
                  <th className="p-3 w-48 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeList.map((inv) => (
                  <tr key={inv.id} className="border-b border-neutral-800/50 hover:bg-neutral-900/20 transition-colors">
                    {/* Party Name */}
                    <td className="p-3">
                      <div className="font-semibold text-neutral-200">{inv.partyName}</div>
                    </td>

                    {/* Invoice number */}
                    <td className="p-3 font-mono text-xs text-neutral-400">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-neutral-650" />
                        {inv.manualInvoiceNo}
                      </span>
                    </td>

                    {/* Invoice date */}
                    <td className="p-3 font-mono text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-neutral-700" />
                        {inv.invoiceDate}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="p-3 text-right font-mono text-neutral-400">৳{inv.totalAmount.toFixed(2)}</td>

                    {/* Paid */}
                    <td className="p-3 text-right font-mono text-emerald-500/80">৳{inv.paidAmount.toFixed(2)}</td>

                    {/* Due */}
                    <td className="p-3 text-right font-mono font-semibold text-amber-400">৳{inv.dueAmount.toFixed(2)}</td>

                    {/* Record button */}
                    <td className="p-3 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {activeTab === 'CUSTOMER' && (
                          <button
                            onClick={() => handleSendSms(inv.id)}
                            disabled={sendingSmsId === inv.id}
                            className="rounded-lg bg-neutral-950 border border-neutral-850 hover:border-neutral-750 px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:text-amber-500 transition-all flex items-center gap-1 disabled:opacity-50 select-none"
                            title={language === 'en' ? 'Send SMS Alert' : 'এসএমএস তাগাদা পাঠান'}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {sendingSmsId === inv.id 
                              ? (language === 'en' ? 'Sending...' : 'পাঠানো হচ্ছে...') 
                              : (language === 'en' ? 'Send SMS' : 'এসএমএস')}
                          </button>
                        )}
                        <button
                          onClick={() => handleRecordPaymentClick(inv)}
                          className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all whitespace-nowrap"
                        >
                          {t('recordPayment')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD PAYMENT MODAL */}
      {paymentModal.isOpen && paymentModal.invoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-100 shadow-2xl font-sans">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h2 className="text-base font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <DollarSign className="h-5 w-5 animate-pulse" />
                {t('recordPayment')}
              </h2>
              <button
                onClick={() => setPaymentModal({ isOpen: false, invoice: null, amount: '' })}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-4">
              {/* Receipt details */}
              <div className="space-y-2 text-xs bg-neutral-950/40 p-4 rounded-xl border border-neutral-800/40">
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('partyName')}</span>
                  <span className="font-semibold text-neutral-200">{paymentModal.invoice.partyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('invoiceNo')}</span>
                  <span className="font-mono text-neutral-300">{paymentModal.invoice.manualInvoiceNo}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800/40 pt-2 mt-2">
                  <span className="text-neutral-500">{language === 'en' ? 'Active Due Balance' : 'চলতি বাকি পরিমাণ'}</span>
                  <span className="font-mono font-bold text-amber-400">৳{paymentModal.invoice.dueAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                  {language === 'en' ? 'Payment Amount (Received/Paid)' : 'পরিশোধের পরিমাণ (জমা/প্রدان)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={paymentModal.invoice.dueAmount}
                  value={paymentModal.amount}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                    setPaymentModal(prev => ({ ...prev, amount: val }));
                  }}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono text-center text-lg animate-pulse"
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPaymentModal({ isOpen: false, invoice: null, amount: '' })}
                  className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs font-semibold hover:bg-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 p-3 text-xs font-semibold text-black transition-colors disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? t('loading') : t('recordPayment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
