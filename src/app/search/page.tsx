'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/context/LanguageContext';
import { getInvoicesAction, getInvoiceItemsAction, exportDatabaseAction, processReturnAction, deleteInvoiceAction } from '@/lib/actions';
import { 
  Search, 
  FileText, 
  ArrowRight, 
  ShoppingBag, 
  TrendingUp, 
  Calendar, 
  User, 
  Layers, 
  X, 
  DollarSign,
  Printer,
  Download,
  RotateCcw,
  Trash2,
  Edit3
} from 'lucide-react';

interface Invoice {
  id: number;
  invoiceType: string;
  manualInvoiceNo: string;
  invoiceDate: string;
  partyName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  expectedPaymentDate?: string | null;
}

interface InvoiceItem {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export default function SearchPage() {
  const { language, t, toast } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail View State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Return Items Modal State
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnProductId, setReturnProductId] = useState<number>(-1);
  const [returnQty, setReturnQty] = useState(1);
  const [returnRefund, setReturnRefund] = useState(0);
  const [returnReason, setReturnReason] = useState('');
  const [processingReturn, setProcessingReturn] = useState(false);

  // Fetch initial invoices
  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      try {
        const list = await getInvoicesAction(query);
        setInvoices(list as any[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Debouncing the input query search
    const delayDebounceFn = setTimeout(() => {
      fetchInvoices();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Load details when an invoice is clicked
  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setLoadingItems(true);
    try {
      const itemList = await getInvoiceItemsAction(invoice.id);
      setItems(itemList as any[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingItems(false);
    }
  };

  return (
    <div className="relative">
      <div className="no-print space-y-6 min-h-[calc(100vh-8rem)]">
        {/* Search Bar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2">
            <Search className="h-5 w-5 text-amber-500" />
            {t('search')}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' ? 'Quickly verify sales and purchase carbon receipts' : 'বেচা ও কেনার কার্বন কপি রসিদগুলো যাচাই করুন'}
          </p>
        </div>

        {/* Search Field */}
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 p-3.5 pl-11 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
        </div>
      </div>

      {/* DB Backup actions (no-print) */}
      <div className="flex flex-wrap items-center justify-between border-b border-neutral-800/60 pb-4 no-print gap-3">
        <span className="text-xs text-neutral-500">
          {language === 'en' ? 'Receipt Archives' : 'রসিদ আর্কাইভ খাতা'}
        </span>
        
        <button
          onClick={async () => {
            try {
              const data = await exportDatabaseAction();
              
              const convertToCsv = (array: any[], headers: string[]) => {
                const rows = array.map(row => 
                  headers.map(header => {
                    const val = row[header];
                    return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : (val === null || val === undefined ? '' : val);
                  }).join(',')
                );
                return [headers.join(','), ...rows].join('\n');
              };

              const triggerDownload = (csvContent: string, fileName: string) => {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.setAttribute('href', url);
                link.setAttribute('download', fileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              };

              // Export Invoices
              const invoicesCsv = convertToCsv(data.invoices, ['id', 'invoiceType', 'manualInvoiceNo', 'invoiceDate', 'partyName', 'totalAmount', 'paidAmount', 'dueAmount', 'expectedPaymentDate']);
              triggerDownload(invoicesCsv, 'eshop_invoices_backup.csv');

              // Export Products
              const productsCsv = convertToCsv(data.products, ['id', 'name', 'category', 'currentStock', 'minStockAlert', 'movingAverageCost']);
              triggerDownload(productsCsv, 'eshop_products_backup.csv');

              // Export Expenses
              const expensesCsv = convertToCsv(data.expenses, ['id', 'title', 'category', 'amount', 'date']);
              triggerDownload(expensesCsv, 'eshop_expenses_backup.csv');

              toast(language === 'en' ? 'Backup files (CSV) generated successfully!' : '৩টি ব্যাকআপ সিএসভি ফাইল সফলভাবে ডাউনলোড হয়েছে!', 'success');
            } catch (err) {
              console.error(err);
              toast('Backup export failed', 'error');
            }
          }}
          className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-850 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-neutral-100 transition-all select-none"
        >
          <Download className="h-4 w-4 text-amber-500 animate-bounce" />
          {language === 'en' ? 'Export CSV Backup' : 'সিএসভি ব্যাকআপ ডাউনলোড'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* INVOICE GRID/LIST */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="text-center py-20 text-xs text-neutral-500">{t('loading')}</div>
          ) : invoices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800 p-20 text-center text-xs text-neutral-500">
              {t('noResults')}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {invoices.map((inv) => {
                const isSales = inv.invoiceType === 'SALES';
                return (
                  <div
                    key={inv.id}
                    onClick={() => handleViewInvoice(inv)}
                    className={`group rounded-2xl border bg-neutral-900/20 p-5 cursor-pointer transition-all duration-300 hover:scale-[1.01] flex items-center justify-between gap-4 ${
                      selectedInvoice?.id === inv.id
                        ? isSales
                          ? 'border-emerald-500 bg-emerald-950/10 shadow-lg shadow-emerald-950/5'
                          : 'border-blue-500 bg-blue-950/10 shadow-lg shadow-blue-950/5'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="space-y-3 flex-1">
                      {/* Badge row */}
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                          isSales
                            ? 'bg-emerald-950/50 border-emerald-800/80 text-emerald-400'
                            : 'bg-blue-950/50 border-blue-800/80 text-blue-400'
                        }`}>
                          {isSales ? t('sales') : t('purchase')}
                        </span>
                        
                        <span className="text-xs font-mono font-semibold text-neutral-300 flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5 text-neutral-500" />
                          {inv.manualInvoiceNo}
                        </span>
                      </div>

                      {/* Info Metadata */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <span className="text-neutral-400 flex items-center gap-1.5 font-medium">
                          <User className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                          <span className="truncate max-w-[120px] sm:max-w-none">{inv.partyName}</span>
                        </span>
                        <span className="text-neutral-500 flex items-center gap-1.5 font-mono text-[11px]">
                          <Calendar className="h-3.5 w-3.5 text-neutral-600 shrink-0" />
                          {inv.invoiceDate}
                        </span>
                      </div>
                    </div>

                    {/* Financial details & Action Arrow */}
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-sm font-bold font-mono text-neutral-100">
                          ৳{inv.totalAmount.toFixed(2)}
                        </div>
                        {inv.dueAmount > 0 && (
                          <div className="text-[10px] font-semibold text-amber-500 uppercase mt-0.5">
                            {t('dueAmount')}: ৳{inv.dueAmount.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-neutral-500 group-hover:text-neutral-200 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SIDEBAR DETAILED RECEIPT VIEW */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 shadow-xl relative overflow-hidden">
          {selectedInvoice ? (
            <div className="space-y-6">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    {language === 'en' ? 'Invoice Summary' : 'রসিদ বিবরণ'}
                  </div>
                  <h2 className="text-base font-bold font-mono text-neutral-100 mt-1">
                    {selectedInvoice.manualInvoiceNo}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Party details */}
              <div className="space-y-3 text-xs bg-neutral-950/40 p-4 rounded-xl border border-neutral-800/40">
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('partyName')}</span>
                  <span className="font-semibold text-neutral-200 text-right">{selectedInvoice.partyName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('invoiceDate')}</span>
                  <span className="font-mono text-neutral-300">{selectedInvoice.invoiceDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{language === 'en' ? 'Transaction Type' : 'লেনদেনের ধরন'}</span>
                  <span className={`font-semibold uppercase ${selectedInvoice.invoiceType === 'SALES' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {selectedInvoice.invoiceType === 'SALES' ? t('sales') : t('purchase')}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  {language === 'en' ? 'Cart Items' : 'পণ্য তালিকা'}
                </h3>
                
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {loadingItems ? (
                    <div className="text-center py-10 text-xs text-neutral-500">{t('loading')}</div>
                  ) : items.length === 0 ? (
                    <div className="text-center py-10 text-xs text-neutral-500">No items found</div>
                  ) : (
                    items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-xl border border-neutral-800/60 bg-neutral-950/20 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-neutral-200">{item.productName}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                            {item.quantity} pcs x ৳{item.unitPrice.toFixed(2)}
                          </div>
                        </div>
                        <div className="font-bold font-mono text-neutral-300">
                          ৳{(item.quantity * item.unitPrice).toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Invoice Totals Breakdown */}
              <div className="border-t border-neutral-800 pt-4 space-y-2.5 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>{t('totalAmount')}</span>
                  <span className="font-mono text-neutral-200">৳{selectedInvoice.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>{t('paidAmount')}</span>
                  <span className="font-mono text-emerald-400">৳{selectedInvoice.paidAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-neutral-800/60 pt-2.5 font-semibold">
                  <span className="text-neutral-300">{t('dueAmount')}</span>
                  <span className={`font-mono ${selectedInvoice.dueAmount > 0 ? 'text-amber-500 animate-pulse' : 'text-emerald-400'}`}>
                    ৳{selectedInvoice.dueAmount.toFixed(2)}
                  </span>
                </div>
                {selectedInvoice.dueAmount > 0 && selectedInvoice.expectedPaymentDate && (
                  <div className="flex justify-between text-[10px] text-neutral-500 border-t border-neutral-800/40 pt-2 font-semibold">
                    <span>{language === 'en' ? 'Collection Target:' : 'পরিশোধের সম্ভাব্য তারিখ:'}</span>
                    <span className="font-mono text-amber-500">{selectedInvoice.expectedPaymentDate}</span>
                  </div>
                )}
              </div>

              {/* Return Items Button */}
              <div className="pt-2 no-print">
                <button
                  onClick={() => {
                    if (items.length > 0) {
                      setReturnProductId(items[0].productId);
                      setReturnQty(1);
                      setReturnRefund(items[0].unitPrice);
                      setReturnReason('');
                      setShowReturnModal(true);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-neutral-850 bg-neutral-900 hover:bg-neutral-850 p-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-all select-none"
                >
                  <RotateCcw className="h-4 w-4" />
                  {language === 'en' ? 'Process Item Return' : 'ত্রুটিপূর্ণ/অতিরিক্ত মাল ফেরত'}
                </button>
              </div>

              {/* Action row (no-print) */}
              <div className="flex gap-2 pt-4 border-t border-neutral-850/60 no-print">
                <button
                  onClick={() => {
                    document.body.classList.add('a4-print-active');
                    window.print();
                    setTimeout(() => {
                      document.body.classList.remove('a4-print-active');
                    }, 500);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-900 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  {language === 'en' ? 'Print A4' : 'A4 মেমো'}
                </button>
                
                <button
                  onClick={() => {
                    document.body.classList.add('pos-print-active');
                    window.print();
                    setTimeout(() => {
                      document.body.classList.remove('pos-print-active');
                    }, 500);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 p-2.5 text-xs font-bold text-black transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  {language === 'en' ? 'Print POS' : 'থার্মাল মেমো'}
                </button>
              </div>

              {/* Edit / Delete Row */}
              <div className="flex gap-2 pt-2 border-t border-neutral-850/60 no-print">
                <button
                  onClick={() => {
                    router.push(`/entry?edit=${selectedInvoice.id}`);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800 p-2.5 text-xs font-semibold text-neutral-300 transition-colors"
                >
                  <Edit3 className="h-4 w-4 text-amber-500" />
                  {language === 'en' ? 'Edit Invoice' : 'সংশোধন (Edit)'}
                </button>

                <button
                  onClick={async () => {
                    const confirmMsg = language === 'en' 
                      ? 'Are you sure you want to delete this invoice? This will revert stocks and party balances!' 
                      : 'আপনি কি নিশ্চিত যে এই ইনভয়েসটি মুছে ফেলতে চান? এটি স্টক এবং বাকির খাতার ব্যালেন্স আগের অবস্থায় ফিরিয়ে নেবে!';
                    if (window.confirm(confirmMsg)) {
                      try {
                        const res = await deleteInvoiceAction(selectedInvoice.id);
                        if (res.success) {
                          toast(language === 'en' ? 'Invoice deleted successfully!' : 'ইনভয়েস সফলভাবে মুছে ফেলা হয়েছে!', 'success');
                          setSelectedInvoice(null);
                          // Refresh invoices list
                          const list = await getInvoicesAction(query);
                          setInvoices(list as any[]);
                        }
                      } catch (err: any) {
                        toast(err.message || 'Failed to delete invoice', 'error');
                      }
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-rose-950/40 bg-rose-950/15 hover:bg-rose-950/30 p-2.5 text-xs font-semibold text-rose-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  {language === 'en' ? 'Delete' : 'মুছে ফেলুন'}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <ShoppingBag className="h-10 w-10 text-neutral-700 mb-3" />
              <p className="text-xs">
                {language === 'en' ? 'Select an invoice to inspect line items, costs, and payment splits.' : 'পণ্য তালিকা ও বিস্তারিত দেখতে যেকোনো রসিদে ক্লিক করুন।'}
              </p>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* POS THERMAL 80mm RECEIPT LAYOUT (PRINT ONLY) */}
      {selectedInvoice && (
        <div className="hidden pos-receipt-container font-mono">
        <div className="text-center border-b border-dashed border-black pb-3 mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider">Fardin Electricals</h2>
          <div className="text-[10px] mt-0.5 font-sans">ফারদিন ইলেক্ট্রিক্যালস</div>
          <div className="text-[9px] mt-0.5">Electrical Sales & Service</div>
          <div className="text-[9px] text-zinc-500 mt-1">Dhaka, Bangladesh</div>
        </div>
          
          <div className="space-y-1 text-[10px] border-b border-dashed border-black pb-3 mb-3">
            <div className="flex justify-between">
              <span>Bill No:</span>
              <span className="font-bold">{selectedInvoice.manualInvoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{selectedInvoice.invoiceDate}</span>
            </div>
            <div className="flex justify-between">
              <span>Party:</span>
              <span className="font-semibold">{selectedInvoice.partyName}</span>
            </div>
            <div className="flex justify-between">
              <span>Type:</span>
              <span className="font-semibold">{selectedInvoice.invoiceType}</span>
            </div>
          </div>

          <div className="space-y-2 border-b border-dashed border-black pb-3 mb-3">
            <div className="grid grid-cols-4 font-bold border-b border-dashed border-zinc-300 pb-1">
              <span className="col-span-2">Item</span>
              <span className="text-center">Qty</span>
              <span className="text-right flex justify-end">Price</span>
            </div>
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-4 text-[10px]">
                <span className="col-span-2 truncate">{item.productName}</span>
                <span className="text-center">{item.quantity}</span>
                <span className="text-right flex justify-end">৳{item.unitPrice.toFixed(0)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-[10px] font-semibold">
            <div className="flex justify-between">
              <span>Total:</span>
              <span>৳{selectedInvoice.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-650">
              <span>Paid Amount:</span>
              <span>৳{selectedInvoice.paidAmount.toFixed(2)}</span>
            </div>
            {selectedInvoice.dueAmount > 0 && (
              <div className="flex justify-between border-t border-dashed border-zinc-350 pt-1">
                <span>Due Amount:</span>
                <span>৳{selectedInvoice.dueAmount.toFixed(2)}</span>
              </div>
            )}
            {selectedInvoice.dueAmount > 0 && selectedInvoice.expectedPaymentDate && (
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span>Target Date:</span>
                <span>{selectedInvoice.expectedPaymentDate}</span>
              </div>
            )}
          </div>

          <div className="text-center text-[9px] mt-6 border-t border-dashed border-black pt-3">
            <div>Thank You! / ধন্যবাদ!</div>
          <div className="text-zinc-400 mt-1">Software: Fardin Electricals Suite</div>
        </div>
        </div>
      )}

      {/* RETURN ITEMS MODAL OVERLAY */}
      {showReturnModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in font-sans no-print">
          <div className="rounded-2xl border border-neutral-850 bg-neutral-900 p-6 max-w-md w-full shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowReturnModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-base font-bold text-neutral-200 flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-rose-400" />
                {language === 'en' ? 'Return Items (Invoice)' : 'মাল ফেরত ও স্টক সমন্বয়'}
              </h2>
              <p className="text-[10px] text-neutral-500 mt-1">
                {language === 'en' 
                  ? `Invoice No: ${selectedInvoice.manualInvoiceNo} | Party: ${selectedInvoice.partyName}`
                  : `ইনভয়েস: ${selectedInvoice.manualInvoiceNo} | পার্টি: ${selectedInvoice.partyName}`}
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Product selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 pl-1 block">
                  {language === 'en' ? 'Select Product to Return' : 'ফেরতযোগ্য পণ্য'}
                </label>
                <select
                  value={returnProductId}
                  onChange={(e) => {
                    const pid = parseInt(e.target.value);
                    setReturnProductId(pid);
                    const it = items.find(i => i.productId === pid);
                    if (it) {
                      setReturnQty(1);
                      setReturnRefund(it.unitPrice);
                    }
                  }}
                  className="w-full rounded-xl border border-neutral-850 bg-neutral-950 p-2.5 text-xs text-neutral-350 outline-none focus:border-amber-500 cursor-pointer"
                >
                  {items.map((it) => (
                    <option key={it.productId} value={it.productId} className="bg-neutral-950 text-neutral-300">
                      {it.productName} (৳{it.unitPrice})
                    </option>
                  ))}
                </select>
              </div>

              {/* Qty & Refund fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 pl-1 block">
                    {language === 'en' ? `Return Qty (Max ${items.find(i => i.productId === returnProductId)?.quantity || 1})` : `ফেরত সংখ্যা (সর্বোচ্চ ${items.find(i => i.productId === returnProductId)?.quantity || 1})`}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={items.find(i => i.productId === returnProductId)?.quantity || 1}
                    value={returnQty}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 0);
                      const it = items.find(i => i.productId === returnProductId);
                      const maxLimit = it ? it.quantity : 1;
                      const finalQty = Math.min(val, maxLimit);
                      setReturnQty(finalQty);
                      if (it) {
                        setReturnRefund(parseFloat((finalQty * it.unitPrice).toFixed(2)));
                      }
                    }}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 pl-1 block">
                    {language === 'en' ? 'Refund Amount' : 'রিফান্ড টাকা'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={(items.find(i => i.productId === returnProductId)?.unitPrice || 0) * returnQty}
                    value={returnRefund}
                    onChange={(e) => setReturnRefund(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 pl-1 block">
                  {language === 'en' ? 'Reason for Return' : 'ফেরত নেওয়ার কারণ'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'en' ? 'e.g. Damaged product, customer exchange' : 'যেমন: ত্রুটিপূর্ণ মালামাল, কাস্টমার বদল...'}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-300 outline-none focus:border-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2.5 pt-3">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 rounded-xl border border-neutral-850 bg-neutral-900 text-neutral-400 hover:text-neutral-200 py-2.5 font-bold transition-all"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  onClick={async () => {
                    if (returnProductId === -1) return;
                    setProcessingReturn(true);
                    try {
                      const res = await processReturnAction(
                        selectedInvoice.id,
                        returnProductId,
                        returnQty,
                        returnRefund,
                        returnReason
                      );
                      if (res.success) {
                        toast(
                          language === 'en' ? 'Return processed successfully!' : 'মাল ফেরত সফলভাবে সম্পন্ন হয়েছে এবং স্টক আপডেট করা হয়েছে!', 
                          'success'
                        );
                        setShowReturnModal(false);
                        // Refresh invoice state
                        const invoicesList = await getInvoicesAction(query);
                        setInvoices(invoicesList as any[]);
                        // Reselect invoice to show updated values
                        const updatedInv = invoicesList.find((i: any) => i.id === selectedInvoice.id);
                        if (updatedInv) {
                          setSelectedInvoice(updatedInv as any);
                          const itms = await getInvoiceItemsAction(updatedInv.id);
                          setItems(itms as any[]);
                        } else {
                          setSelectedInvoice(null);
                        }
                      }
                    } catch (err: any) {
                      console.error(err);
                      toast(err.message || 'Return processing failed', 'error');
                    } finally {
                      setProcessingReturn(false);
                    }
                  }}
                  disabled={processingReturn}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold py-2.5 transition-all disabled:opacity-50"
                >
                  {processingReturn 
                    ? (language === 'en' ? 'Processing...' : 'প্রসেস হচ্ছে...') 
                    : (language === 'en' ? 'Confirm Return' : 'ফেরত নিশ্চিত করুন')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A4 RETAIL RECEIPT LAYOUT (PRINT ONLY) */}
      {selectedInvoice && (
        <div className="hidden a4-receipt-container font-sans p-6 text-black bg-white">
          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b-2 border-zinc-350 pb-6 mb-6">
            <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-zinc-900">Fardin Electricals</h2>
            <p className="text-[11px] font-bold text-zinc-700 mt-0.5">ফারদিন ইলেক্ট্রিক্যালস</p>
            <p className="text-[10px] text-zinc-500 mt-1">Electrical Sales & Services</p>
            <p className="text-[10px] text-zinc-500">Dhaka, Bangladesh | Phone: 017XXXXXXXX</p>
          </div>
            <div className="text-right">
              <h3 className="text-base font-extrabold uppercase text-zinc-800 tracking-wider">
                {selectedInvoice.invoiceType === 'SALES' ? 'Retail Invoice' : 'Purchase Invoice'}
              </h3>
              <p className="text-xs font-mono font-bold text-zinc-600 mt-1">
                Invoice No: {selectedInvoice.manualInvoiceNo}
              </p>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                Date: {selectedInvoice.invoiceDate}
              </p>
            </div>
          </div>

          {/* Party Details */}
          <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                {selectedInvoice.invoiceType === 'SALES' ? 'Bill To (Customer)' : 'Bill From (Supplier)'}
              </span>
              <span className="font-bold text-zinc-800 text-sm">{selectedInvoice.partyName}</span>
            </div>
            
            <div className="text-right space-y-1">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Transaction Summary</span>
              <span className="font-mono font-semibold text-zinc-700">
                Mode: {selectedInvoice.invoiceType === 'SALES' ? 'Sales / ক্যাশ ও বাকি' : 'Purchase / ক্রয়'}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs text-left border-collapse mb-8 border border-zinc-300">
            <thead>
              <tr className="bg-zinc-100 font-bold border-b border-zinc-300">
                <th className="p-3 border-r border-zinc-300 w-10 text-center">#</th>
                <th className="p-3 border-r border-zinc-300">Product Name / বিবরণ</th>
                <th className="p-3 border-r border-zinc-300 w-24 text-center">Qty / পরিমাণ</th>
                <th className="p-3 border-r border-zinc-300 w-32 text-right">Unit Price / দর</th>
                <th className="p-3 w-32 text-right">Total / মূল্য</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.id} className="border-b border-zinc-300 hover:bg-zinc-50/50">
                  <td className="p-3 border-r border-zinc-300 text-center font-mono">{idx + 1}</td>
                  <td className="p-3 border-r border-zinc-300 font-semibold text-zinc-850">{item.productName}</td>
                  <td className="p-3 border-r border-zinc-300 text-center font-mono">{item.quantity}</td>
                  <td className="p-3 border-r border-zinc-300 text-right font-mono">৳{item.unitPrice.toFixed(2)}</td>
                  <td className="p-3 text-right font-mono font-bold">৳{(item.quantity * item.unitPrice).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Invoice Summary Totals */}
          <div className="flex justify-between items-start gap-8 mb-16 text-xs">
            <div className="w-1/2 space-y-2 border border-zinc-200 p-4 rounded-xl">
              <span className="text-[9px] font-bold uppercase text-zinc-400 block">Terms & Reminders</span>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                পণ্য ক্রয়ের জন্য ধন্যবাদ। ওয়ারেন্টিযুক্ত পণ্যের ক্ষেত্রে ক্রয়ের মেমো সাথে রাখুন।
              </p>
              {selectedInvoice.dueAmount > 0 && selectedInvoice.expectedPaymentDate && (
                <div className="mt-2.5 pt-2.5 border-t border-zinc-200 flex justify-between font-bold">
                  <span className="text-amber-700">Expected Collection Target:</span>
                  <span className="font-mono text-amber-700">{selectedInvoice.expectedPaymentDate}</span>
                </div>
              )}
            </div>

            <div className="w-1/3 space-y-2.5 border border-zinc-200 p-4 rounded-xl font-semibold">
              <div className="flex justify-between text-zinc-500 text-[11px]">
                <span>Total Amount:</span>
                <span className="font-mono text-zinc-800">৳{selectedInvoice.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-500 text-[11px]">
                <span>Paid Amount:</span>
                <span className="font-mono text-emerald-600">৳{selectedInvoice.paidAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 font-extrabold text-sm text-zinc-900">
                <span>Due Amount:</span>
                <span className={`font-mono ${selectedInvoice.dueAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  ৳{selectedInvoice.dueAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between items-center mt-20 pt-10 text-[10px] text-zinc-400 font-mono">
            <div className="text-center w-36 border-t border-dashed border-zinc-300 pt-1.5">
              Customer Signature
            </div>
            <div className="text-center w-36 border-t border-dashed border-zinc-300 pt-1.5 font-bold text-zinc-700">
              Authorized Signature
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
