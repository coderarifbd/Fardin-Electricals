'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';

type Language = 'en' | 'bn';
type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const translations = {
  en: {
    dashboard: 'Dashboard',
    backEntry: 'Back-Entry',
    search: 'Search Invoices',
    ledger: 'Dues Ledger',
    expenses: 'Expenses',
    reports: 'Reports',
    toggleLanguage: 'বাংলা',
    activeMode: 'Active Mode',
    sales: 'Sales',
    purchase: 'Purchase',
    totalSales: 'Total Sales',
    totalPurchases: 'Total Purchases',
    totalExpenses: 'Total Expenses',
    netProfit: 'Net Profit',
    cogs: 'Cost of Goods Sold (COGS)',
    weeklyCashflow: 'Weekly Cashflow (Invoice Dates)',
    topSelling: 'Top 5 Selling Products',
    deadStock: 'Dead Stock Alert (>60 days)',
    lowStock: 'Low Stock Notification',
    negativeStockWarning: 'Amber warning indicates negative stock. Transaction will proceed.',
    partyName: 'Party Name (Customer/Supplier)',
    invoiceNo: 'Manual Invoice No.',
    invoiceDate: 'Invoice Date',
    productName: 'Product Name',
    category: 'Category',
    quantity: 'Quantity',
    unitPrice: 'Unit Price',
    totalAmount: 'Total Amount',
    paidAmount: 'Paid Amount',
    dueAmount: 'Due Amount',
    recordPayment: 'Record Payment',
    paymentHistory: 'Payment History',
    customerDues: 'Customer Dues (বাকির খাতা)',
    supplierPayables: 'Supplier Payables (পাওনা খাতা)',
    expenseTitle: 'Expense Title',
    expenseCategory: 'Category',
    expenseAmount: 'Amount',
    expenseDate: 'Expense Date',
    submit: 'Submit (Ctrl + Enter)',
    quickAddProduct: 'Quick Add Product',
    shortcuts: 'Keyboard Shortcuts',
    viewShortcuts: 'Press [?] for Shortcuts',
    noProductsFound: 'No products found. Press Enter to Quick-Add.',
    addProduct: 'Add Product',
    minStock: 'Min Stock Alert',
    successInvoice: 'Invoice saved successfully!',
    successPayment: 'Payment recorded successfully!',
    successExpense: 'Expense logged successfully!',
    successProduct: 'Product added successfully!',
    allFieldsRequired: 'Please fill all required fields',
    loading: 'Loading...',
    demoModeText: 'Demo Mode (Local Data)',
    postgresModeText: 'Connected to Neon Postgres',
    noResults: 'No invoices found',
    cogsTooltip: 'Calculated using Moving Average Cost.',
    searchPlaceholder: 'Search by Invoice No. or Party Name...',
    itemGridHelp: 'Press [Enter] or [Tab] to navigate cells. Pressing [Enter] on unit price adds row. Press [Delete] on product name to remove row.',
  },
  bn: {
    dashboard: 'ড্যাশবোর্ড',
    backEntry: 'সাপ্তাহিক এন্ট্রি',
    search: 'ইনভয়েস অনুসন্ধান',
    ledger: 'বাকির খাতা',
    expenses: 'দোকান খরচ',
    reports: 'রিপোর্ট খাতা',
    toggleLanguage: 'English',
    activeMode: 'চলতি মোড',
    sales: 'বিক্রয়',
    purchase: 'ক্রয়',
    totalSales: 'মোট বিক্রয়',
    totalPurchases: 'মোট ক্রয়',
    totalExpenses: 'মোট খরচ',
    netProfit: 'নিট লাভ',
    cogs: 'বিক্রিত পণ্যের ব্যয় (COGS)',
    weeklyCashflow: 'সাপ্তাহিক ক্যাশফ্লো (ইনভয়েস তারিখ)',
    topSelling: 'সেরা ৫ বিক্রিত পণ্য',
    deadStock: 'অচল স্টক (>৬০ দিন)',
    lowStock: 'স্বল্প স্টক সতর্কবার্তা',
    negativeStockWarning: 'হলুদ ডট নেতিবাচক স্টক নির্দেশ করে। এন্ট্রি আটকানো হবে না।',
    partyName: 'পার্টির নাম (ক্রেতা/বিক্রেতা)',
    invoiceNo: 'ইনভয়েস নম্বর',
    invoiceDate: 'ইনভয়েসের তারিখ',
    productName: 'পণ্যের নাম',
    category: 'ক্যাটাগরি',
    quantity: 'পরিমাণ',
    unitPrice: 'দর/মূল্য',
    totalAmount: 'মোট মূল্য',
    paidAmount: 'নগদ জমা',
    dueAmount: 'বাকি টাকা',
    recordPayment: 'টাকা জমা নিন',
    paymentHistory: 'জমা খরচের ইতিহাস',
    customerDues: 'কাস্টমার বাকি (বাকির খাতা)',
    supplierPayables: 'মহাজন পাওনা (পাওনা খাতা)',
    expenseTitle: 'খরচের বিবরণ',
    expenseCategory: 'ক্যাটাগরি',
    expenseAmount: 'খরচের পরিমাণ',
    expenseDate: 'খরচের তারিখ',
    submit: 'সাবমিট করুন (Ctrl + Enter)',
    quickAddProduct: 'নতুন পণ্য যোগ',
    shortcuts: 'কীবোর্ড শর্টকাট',
    viewShortcuts: 'শর্টকাটের জন্য [?] চাপুন',
    noProductsFound: 'কোনো পণ্য পাওয়া যায়নি। Quick-Add করতে Enter চাপুন।',
    addProduct: 'পণ্য যোগ করুন',
    minStock: 'সর্বনিম্ন স্টক এলার্ট',
    successInvoice: 'ইনভয়েস সফলভাবে সংরক্ষণ করা হয়েছে!',
    successPayment: 'টাকা জমা সফল হয়েছে!',
    successExpense: 'খরচ সফলভাবে লিপিবদ্ধ করা হয়েছে!',
    successProduct: 'নতুন পণ্য সফলভাবে তৈরি হয়েছে!',
    allFieldsRequired: 'দয়া করে সব ঘর পূরণ করুন',
    loading: 'লোড হচ্ছে...',
    demoModeText: 'ডেমো মোড (লোকাল ডাটা)',
    postgresModeText: 'Neon Postgres কানেক্টেড',
    noResults: 'কোনো ইনভয়েস পাওয়া যায়নি',
    cogsTooltip: 'পণ্যের চলন্ত গড় মূল্যের (Moving Average Cost) ভিত্তিতে হিসাবকৃত।',
    searchPlaceholder: 'ইনভয়েস নম্বর বা পার্টির নাম লিখুন...',
    itemGridHelp: '[Enter] বা [Tab] টিপে সেলে সরুন। মূল্যের সেলে [Enter] চাপলে নতুন সারি যোগ হবে। ডিলিট করতে পণ্যের নামের ঘরে [Delete] টিপুন।',
  }
};

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations.en) => string;
  toast: (message: string, type?: ToastType) => void;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('eshop_lang') as Language;
    if (saved === 'en' || saved === 'bn') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('eshop_lang', lang);
  };

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key] || String(key);
  };

  const toast = (message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toast }}>
      {children}
      {/* Toast Render Area */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 p-4 rounded-xl border shadow-xl transition-all duration-300 pointer-events-auto animate-slide-in ${
              t.type === 'success'
                ? 'bg-neutral-900 border-emerald-800 text-emerald-300'
                : t.type === 'error'
                ? 'bg-neutral-900 border-rose-800 text-rose-300'
                : 'bg-neutral-900 border-amber-800 text-amber-300'
            }`}
          >
            {t.type === 'success' && <CheckCircle className="h-5 w-5 shrink-0 text-emerald-500" />}
            {t.type === 'error' && <XCircle className="h-5 w-5 shrink-0 text-rose-500" />}
            {t.type === 'warning' && <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />}
            
            <div className="flex-1 text-sm font-medium">{t.message}</div>
            
            <button
              onClick={() => setToasts((prev) => prev.filter((to) => to.id !== t.id))}
              className="p-0.5 hover:bg-neutral-800 rounded transition-colors text-neutral-400 hover:text-neutral-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
