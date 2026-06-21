'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/context/LanguageContext';
import { Keyboard, X } from 'lucide-react';

export default function KeyboardShortcuts() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle help overlay on '?' (Shift + /)
      // Only trigger if not typing in input/textarea (unless Alt key is pressed)
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (e.key === '?' && !isTyping) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      if (e.key === 'Escape') {
        setIsOpen(false);
      }

      // Alt modifier shortcuts (work even when typing!)
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'd': // Alt + D -> Dashboard
            e.preventDefault();
            router.push('/');
            break;
          case 's': // Alt + S -> Sales Entry
            e.preventDefault();
            router.push('/entry?type=SALES');
            break;
          case 'p': // Alt + P -> Purchase Entry
            e.preventDefault();
            router.push('/entry?type=PURCHASE');
            break;
          case 'g': // Alt + G -> Global Search
            e.preventDefault();
            router.push('/search');
            break;
          case 'l': // Alt + L -> Ledger
            e.preventDefault();
            router.push('/ledger');
            break;
          case 'e': // Alt + E -> Expenses
            e.preventDefault();
            router.push('/expenses');
            break;
          case 't': // Alt + T -> Toggle Translation
            e.preventDefault();
            setLanguage(language === 'en' ? 'bn' : 'en');
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, language, setLanguage]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-100 shadow-2xl shadow-black/80">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Keyboard className="h-5 w-5" />
            <h2 className="text-lg font-semibold tracking-wide">{t('shortcuts')}</h2>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 font-mono text-sm">
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + D</span>
            <span className="text-neutral-200">{language === 'en' ? 'Go to Dashboard' : 'ড্যাশবোর্ডে যান'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + S</span>
            <span className="text-neutral-200">{language === 'en' ? 'Sales Entry Screen' : 'বিক্রয় এন্ট্রি স্ক্রিন'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + P</span>
            <span className="text-neutral-200">{language === 'en' ? 'Purchase Entry Screen' : 'ক্রয় এন্ট্রি স্ক্রিন'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + G</span>
            <span className="text-neutral-200">{language === 'en' ? 'Global Search Invoices' : 'ইনভয়েস অনুসন্ধান'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + L</span>
            <span className="text-neutral-200">{language === 'en' ? 'Dues Ledger (বাকির খাতা)' : 'বাকির খাতা'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + E</span>
            <span className="text-neutral-200">{language === 'en' ? 'Expenses Logger' : 'দোকান খরচ হিসাব'}</span>
          </div>
          <div className="flex justify-between border-b border-neutral-800 pb-2">
            <span className="text-neutral-400">Alt + T</span>
            <span className="text-neutral-200">{language === 'en' ? 'Toggle English / Bengali' : 'ইংরেজি / বাংলা পরিবর্তন'}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-neutral-400">? (Shift + /)</span>
            <span className="text-neutral-200">{language === 'en' ? 'Show/Hide Keyboard Shortcuts' : 'শর্টকাট প্যানেল খুলুন/বন্ধ করুন'}</span>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-neutral-950 p-3 text-center text-xs text-neutral-500">
          {language === 'en' ? 'Esc to close help menu' : 'বন্ধ করতে Esc চাপুন'}
        </div>
      </div>
    </div>
  );
}
