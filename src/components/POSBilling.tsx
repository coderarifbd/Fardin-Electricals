'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { 
  searchProductsAction, 
  saveInvoiceAction, 
  getPartiesAction,
  getNextInvoiceNoAction 
} from '@/lib/actions';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Zap, 
  Keyboard, 
  Printer, 
  DollarSign, 
  Save, 
  User, 
  Calendar, 
  Barcode, 
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  unit?: string;
  hasVariants?: boolean;
  variants?: {
    id: number;
    productId: number;
    name: string;
    currentStock: number;
    minStockAlert: number;
    movingAverageCost: number;
    barcode?: string | null;
  }[];
}

interface CartItem {
  product: Product;
  selectedVariantId?: number | null;
  quantity: number;
  unitPrice: number;
}

export default function POSBilling() {
  const { language, t, toast } = useLanguage();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  
  // Invoice form metadata
  const [manualInvoiceNo, setManualInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vatRate, setVatRate] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number | ''>('');

  // Search autocomplete for manual products search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  // Party autocomplete
  const [partiesList, setPartiesList] = useState<{ id: number; name: string }[]>([]);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);

  // References
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load defaults
  useEffect(() => {
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    fetchNextInvoiceNo();
    loadParties();
    
    // Auto focus barcode input on mount
    barcodeInputRef.current?.focus();
    
    // Global key listener for shortcuts
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Avoid shortcuts when typing in search modal or other text inputs
      if (document.activeElement?.tagName === 'INPUT' && document.activeElement !== barcodeInputRef.current) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setShowSearchModal(false);
          barcodeInputRef.current?.focus();
        }
        return;
      }

      // F2: Search modal
      if (e.key === 'F2') {
        e.preventDefault();
        setShowSearchModal(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      
      // F8: Focus payment amount
      if (e.key === 'F8') {
        e.preventDefault();
        const payInput = document.getElementById('pos-payment-input');
        payInput?.focus();
      }

      // F9: Checkout
      if (e.key === 'F9') {
        e.preventDefault();
        handleCheckout();
      }

      // Esc: Clear cart or focus barcode
      if (e.key === 'Escape') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [cart, manualInvoiceNo, partyName, paidAmount, expectedPaymentDate]);

  const fetchNextInvoiceNo = async () => {
    try {
      const suggested = await getNextInvoiceNoAction('SALES');
      if (suggested) {
        setManualInvoiceNo(suggested);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadParties = async () => {
    try {
      const list = await getPartiesAction('CUSTOMER');
      setPartiesList(list as any);
    } catch (e) {
      console.error(e);
    }
  };

  // Sound Beep Generator (Web Audio API)
  const playBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'success') {
        oscillator.frequency.value = 880; // high beep
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.frequency.value = 220; // low buzz
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.25);
      }
    } catch (err) {
      console.error('Audio beep failed:', err);
    }
  };

  // Handle Barcode Scan Submit
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    try {
      const results = await searchProductsAction(barcode);
      
      // Match by barcode in product or variants
      let matchedProduct: Product | null = null;
      let matchedVariantId: number | null = null;

      for (const p of results) {
        if (p.barcode === barcode) {
          matchedProduct = p;
          matchedVariantId = null;
          break;
        }
        if (p.variants) {
          const v = p.variants.find(varRow => varRow.barcode === barcode);
          if (v) {
            matchedProduct = p;
            matchedVariantId = v.id;
            break;
          }
        }
      }

      if (matchedProduct) {
        addToCart(matchedProduct, matchedVariantId);
        playBeep('success');
        toast(
          language === 'en' 
            ? `Scanned: ${matchedProduct.name}`
            : `স্ক্যান হয়েছে: ${matchedProduct.name}`, 
          'success'
        );
      } else {
        playBeep('error');
        toast(
          language === 'en' 
            ? `Barcode "${barcode}" not registered.` 
            : `বারকোড "${barcode}" পণ্য তালিকায় খুঁজে পাওয়া যায়নি।`, 
          'error'
        );
      }
    } catch (err) {
      console.error(err);
      playBeep('error');
    } finally {
      setBarcodeInput('');
    }
  };

  const addToCart = (product: Product, variantId?: number | null) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(
        item => item.product.id === product.id && item.selectedVariantId === variantId
      );

      if (existingIdx !== -1) {
        // Increase qty
        return prev.map((item, idx) => 
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        // Add new
        const variant = product.variants?.find(v => v.id === variantId);
        const baseCost = variant ? variant.movingAverageCost : product.movingAverageCost;
        const retailPrice = baseCost * 1.25; // 25% markup default
        return [
          ...prev, 
          { 
            product, 
            selectedVariantId: variantId || null, 
            quantity: 1, 
            unitPrice: parseFloat(retailPrice.toFixed(2)) 
          }
        ];
      }
    });
  };

  const updateQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, idx) => {
      if (idx === index) {
        const nextQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: nextQty };
      }
      return item;
    }));
  };

  const updatePrice = (index: number, newPrice: number) => {
    setCart(prev => prev.map((item, idx) => 
      idx === index ? { ...item, unitPrice: newPrice } : item
    ));
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
    playBeep('success');
  };

  // Manual search handlers
  const handleSearchChange = async (value: string) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const list = await searchProductsAction(value);
      setSearchResults(list);
      setActiveSearchIndex(0);
    } catch (e) {
      console.error(e);
    }
  };

  const selectManualSearchResult = (product: Product) => {
    const vId = product.variants && product.variants.length > 0 ? product.variants[0].id : null;
    addToCart(product, vId);
    setShowSearchModal(false);
    setSearchQuery('');
    setSearchResults([]);
    barcodeInputRef.current?.focus();
    playBeep('success');
  };

  const handleCheckout = async () => {
    if (isSubmitting) return;
    if (cart.length === 0) {
      toast(language === 'en' ? 'Cart is empty' : 'কার্ট খালি!', 'error');
      playBeep('error');
      return;
    }
    if (!manualInvoiceNo || !partyName) {
      toast(language === 'en' ? 'Invoice number and party name are required' : 'বিল নম্বর এবং গ্রাহকের নাম আবশ্যক', 'error');
      playBeep('error');
      return;
    }

    setIsSubmitting(true);
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const vatAmount = subtotal * (vatRate / 100);
    const discountVal = typeof discountAmount === 'number' ? discountAmount : 0;
    const totalAmount = Math.max(0, subtotal + vatAmount - discountVal);
    const finalPaid = paidAmount === '' ? totalAmount : paidAmount;
    const dueAmount = Math.max(0, totalAmount - finalPaid);

    const invoicePayload = {
      invoiceType: 'SALES' as const,
      manualInvoiceNo,
      invoiceDate,
      partyName,
      totalAmount,
      paidAmount: finalPaid,
      dueAmount,
      expectedPaymentDate: dueAmount > 0 ? expectedPaymentDate : null,
      vatRate,
      vatAmount,
      discountAmount: discountVal
    };

    const itemsPayload = cart.map(item => ({
      productId: item.product.id,
      variantId: item.selectedVariantId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));

    try {
      const res = await saveInvoiceAction(invoicePayload, itemsPayload);
      if (res.success) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
        toast(language === 'en' ? 'Sale billed successfully!' : 'হিসাব সফলভাবে সংরক্ষণ করা হয়েছে!', 'success');
        
        // Print Thermal Receipt automatically
        setTimeout(() => {
          window.print();
        }, 300);

        // Reset
        setCart([]);
        setPartyName('');
        setPaidAmount('');
        setDiscountAmount('');
        setExpectedPaymentDate('');
        fetchNextInvoiceNo();
        barcodeInputRef.current?.focus();
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Billing failed', 'error');
      playBeep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculation variables
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const vatAmount = subtotal * (vatRate / 100);
  const discountVal = typeof discountAmount === 'number' ? discountAmount : 0;
  const totalAmount = Math.max(0, subtotal + vatAmount - discountVal);
  const dueAmount = Math.max(0, totalAmount - (typeof paidAmount === 'number' ? paidAmount : totalAmount));

  return (
    <div className="space-y-6">
      
      {/* 1. TOP CONTROL BAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between no-print">
        {/* Barcode scanner focused input */}
        <form onSubmit={handleBarcodeSubmit} className="w-full md:max-w-md relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-neutral-500">
            <Barcode className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <input
            ref={barcodeInputRef}
            type="text"
            placeholder={language === 'en' ? 'Scan Barcode or type code...' : 'বারকোড স্ক্যান করুন বা লিখুন...'}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 pl-12 pr-20 text-sm text-neutral-200 outline-none focus:border-amber-500 focus:bg-neutral-950 transition-all font-mono placeholder-neutral-600"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer select-none"
          >
            {language === 'en' ? 'Scan' : 'স্ক্যান'}
          </button>
        </form>

        {/* F2 Manual product lookup trigger */}
        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => {
              setShowSearchModal(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 hover:bg-neutral-900 px-5 py-3 text-xs font-bold text-neutral-300 transition-colors cursor-pointer select-none"
          >
            <Search className="h-4.5 w-4.5 text-neutral-400" />
            <span>{language === 'en' ? 'Search Product (F2)' : 'খুঁজুন (F2)'}</span>
          </button>
          
          <button
            onClick={() => {
              setCart([]);
              fetchNextInvoiceNo();
              barcodeInputRef.current?.focus();
            }}
            className="flex items-center justify-center p-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 hover:bg-rose-950/20 text-neutral-500 hover:text-rose-400 transition-colors cursor-pointer"
            title="Reset Cart"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* 2. MAIN SPLIT PANE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start no-print">
        
        {/* Left Side: Cart items (2/3 width) */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm shadow-xl overflow-hidden min-h-[450px] flex flex-col justify-between">
          <div className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center gap-2">
              <Zap className="h-4.5 w-4.5 text-amber-500 fill-amber-500/10" />
              {language === 'en' ? 'POS Sales Cart' : 'পিওএস সেলস কার্ট'}
              <span className="ml-auto text-xs font-mono text-neutral-500">
                {cart.reduce((sum, item) => sum + item.quantity, 0)} items
              </span>
            </h2>

            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-neutral-600 gap-3">
                <Barcode className="h-16 w-16 stroke-[1.2] text-neutral-700 animate-pulse" />
                <div className="text-sm font-semibold">{language === 'en' ? 'Cart is empty. Scan products to check out.' : 'কার্ট খালি! পণ্য স্ক্যান করা শুরু করুন।'}</div>
                <div className="text-[10px] text-neutral-500 bg-neutral-950 border border-neutral-850 px-2.5 py-1 rounded-lg">
                  {language === 'en' ? 'Shortcut: Press F2 to search manually' : 'শর্টকাট: ম্যানুয়ালি খুঁজতে F2 চাপুন'}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/60 overflow-y-auto max-h-[420px] pr-1">
                {cart.map((item, index) => {
                  const lineTotal = item.quantity * item.unitPrice;
                  const selectedVar = item.product.variants?.find(v => v.id === item.selectedVariantId);
                  
                  return (
                    <div key={`${item.product.id}-${item.selectedVariantId}`} className="flex items-center justify-between py-4 first:pt-2 last:pb-0 group">
                      <div className="space-y-1.5 max-w-[50%]">
                        <div className="text-xs font-bold text-neutral-200 truncate">{item.product.name}</div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono text-neutral-500 bg-neutral-950 border border-neutral-850 px-1.5 py-0.5 rounded">
                            {item.product.category}
                          </span>
                          {item.product.variants && item.product.variants.length > 0 ? (
                            <select
                              value={item.selectedVariantId || ''}
                              onChange={(e) => {
                                const vId = Number(e.target.value);
                                const v = item.product.variants?.find(x => x.id === vId);
                                if (v) {
                                  const baseCost = v.movingAverageCost || item.product.movingAverageCost;
                                  const retailPrice = baseCost * 1.25; // 25% markup default
                                  setCart(prev => prev.map((cItem, cIdx) => cIdx === index ? {
                                    ...cItem,
                                    selectedVariantId: vId,
                                    unitPrice: parseFloat(retailPrice.toFixed(2))
                                  } : cItem));
                                }
                              }}
                              className="bg-neutral-950 border border-neutral-850 rounded px-1.5 py-0.5 text-[9px] text-purple-400 outline-none focus:border-amber-500 font-bold cursor-pointer max-w-[120px] truncate"
                            >
                              {item.product.variants.map(v => (
                                <option key={v.id} value={v.id} className="bg-neutral-950 text-neutral-200">
                                  {v.name} (Stock: {v.currentStock} {item.product.unit || 'pcs'})
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </div>

                      {/* Quantity selector */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => updateQty(index, -1)}
                          className="h-7 w-7 rounded-lg border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all select-none cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-10 text-center font-bold text-xs text-neutral-100 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(index, 1)}
                          className="h-7 w-7 rounded-lg border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all select-none cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Unit Price editable */}
                      <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-850 rounded-xl px-2.5 py-1.5 w-24 shrink-0">
                        <span className="text-xs text-neutral-500 font-mono">৳</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={(e) => updatePrice(index, parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent border-0 outline-none text-right font-mono text-xs text-neutral-200"
                        />
                      </div>

                      <div className="w-24 text-right font-bold font-mono text-xs text-neutral-200 shrink-0">
                        ৳{lineTotal.toFixed(2)}
                      </div>

                      {/* Remove button */}
                      <button
                        onClick={() => removeItem(index)}
                        className="text-neutral-600 hover:text-rose-500 rounded p-1 hover:bg-rose-950/20 transition-all shrink-0 cursor-pointer ml-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-neutral-950/20 border-t border-neutral-850 flex justify-between items-center text-[10px] text-neutral-500 font-mono">
            <span>Shortcut: [F2] Search, [F8] Payment, [F9] Print/Save</span>
            <span>Ctrl + Enter also saves & prints</span>
          </div>
        </div>

        {/* Right Side: Billing control details (1/3 width) */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
          
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center justify-between">
            <span>{language === 'en' ? 'Summary' : 'বিলের বিবরণ'}</span>
            <span className="text-xs font-mono text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
              {manualInvoiceNo}
            </span>
          </h2>

          <div className="space-y-4 text-xs">
            {/* Customer name auto suggestion input */}
            <div className="space-y-1.5 relative">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-neutral-500" />
                {t('partyName')}
              </label>
              <input
                type="text"
                placeholder={language === 'en' ? 'e.g. Walking Customer' : 'যেমন: খুচরা খদ্দের'}
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                onFocus={() => setShowPartySuggestions(true)}
                onBlur={() => setTimeout(() => setShowPartySuggestions(false), 200)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500 transition-colors"
              />
              {showPartySuggestions && partiesList.filter(p => p.name.toLowerCase().includes(partyName.toLowerCase())).length > 0 && (
                <div className="absolute left-0 right-0 top-[65px] z-50 max-h-40 overflow-y-auto rounded-xl border border-neutral-850 bg-neutral-900 shadow-2xl p-1 text-xs">
                  {partiesList
                    .filter(p => p.name.toLowerCase().includes(partyName.toLowerCase()))
                    .map(p => (
                      <div
                        key={p.id}
                        onClick={() => setPartyName(p.name)}
                        className="px-3 py-2 hover:bg-neutral-800 hover:text-amber-400 text-neutral-300 rounded-lg cursor-pointer transition-colors"
                      >
                        {p.name}
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Invoice Date */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-neutral-500" />
                {t('invoiceDate')}
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors font-mono"
              />
            </div>

            {/* Total and Paid and Due */}
            <div className="border-t border-neutral-800 pt-4 space-y-3">
              <div className="flex items-center justify-between text-neutral-400">
                <span>{language === 'en' ? 'Subtotal' : 'উপমোট'}</span>
                <span className="font-mono">৳{subtotal.toFixed(2)}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                  {language === 'en' ? 'VAT (%)' : 'ভ্যাট (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={vatRate || ''}
                  placeholder="0"
                  onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-450">
                  {language === 'en' ? 'Discount (৳)' : 'ডিসকাউন্ট (৳)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  placeholder="0.00"
                  onChange={(e) => setDiscountAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {vatAmount > 0 && (
                <div className="flex items-center justify-between text-neutral-500 text-[10px] font-mono">
                  <span>VAT ({vatRate}%):</span>
                  <span>+৳{vatAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-neutral-850 pt-3 text-neutral-400">
                <span className="font-bold">{t('totalAmount')}</span>
                <span className="text-base font-bold font-mono text-neutral-200">৳{totalAmount.toFixed(2)}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-neutral-500" />
                  {t('paidAmount')}
                </label>
                <input
                  id="pos-payment-input"
                  type="number"
                  step="0.01"
                  placeholder={`৳${totalAmount.toFixed(2)}`}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between border-t border-neutral-850 pt-3">
                <span className="font-medium text-neutral-400">{t('dueAmount')}</span>
                <span className={`text-base font-bold font-mono ${dueAmount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                  ৳{dueAmount.toFixed(2)}
                </span>
              </div>

              {dueAmount > 0 && (
                <div className="space-y-1.5 pt-2 animate-slide-in">
                  <label className="text-[10px] font-semibold text-neutral-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    {language === 'en' ? 'EXPECTED PAYMENT DATE' : 'বাকি পরিশোধের সম্ভাব্য তারিখ'}
                  </label>
                  <input
                    type="date"
                    required
                    value={expectedPaymentDate}
                    onChange={(e) => setExpectedPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Save & Print button */}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-4 text-xs font-bold uppercase tracking-wider text-white shadow-xl transition-all duration-200 cursor-pointer ${
                isSubmitting 
                  ? 'bg-neutral-850 text-neutral-600 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-500 hover:shadow-emerald-950/20 active:scale-[0.98]'
              }`}
            >
              <Printer className="h-4.5 w-4.5" />
              {isSubmitting ? (language === 'en' ? 'Billiing...' : 'হিসাব সংরক্ষণ হচ্ছে...') : (language === 'en' ? 'Bill & Print Receipt (F9)' : 'হিসাব ও রশিদ প্রিন্ট (F9)')}
            </button>
          </div>
        </div>
      </div>

      {/* 3. PRINT RECEIPT LAYOUT (Only visible during print via media queries) */}
      <div className="print-receipt-container hidden print:block text-black bg-white p-4 font-mono text-xs w-[80mm] mx-auto">
        <div className="text-center space-y-1">
          <h2 className="text-sm font-black uppercase tracking-wide">Fardin Electricals</h2>
          <p className="text-[9px]">Chawkbazar, Nawabpur, Dhaka</p>
          <p className="text-[9px]">Phone: 01711122233</p>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        <div className="space-y-0.5 text-[10px]">
          <div className="flex justify-between">
            <span>Bill No: {manualInvoiceNo}</span>
            <span>Date: {invoiceDate}</span>
          </div>
          <div>Customer: {partyName || 'Walking Customer'}</div>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        <table className="w-full text-left text-[10px]">
          <thead>
            <tr className="border-b border-black font-bold">
              <th>Item</th>
              <th className="text-center">Qty</th>
              <th className="text-right">Price</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {cart.map((item, idx) => {
              const lineTotal = item.quantity * item.unitPrice;
              const selectedVar = item.product.variants?.find(v => v.id === item.selectedVariantId);
              return (
                <tr key={idx} className="border-b border-neutral-100">
                  <td className="py-1">
                    {item.product.name} {selectedVar ? `(${selectedVar.name})` : ''}
                  </td>
                  <td className="text-center py-1">{item.quantity}</td>
                  <td className="text-right py-1">৳{item.unitPrice.toFixed(0)}</td>
                  <td className="text-right py-1">৳{lineTotal.toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t border-dashed border-black my-2" />

        <div className="space-y-1 text-right text-[10px] font-bold">
          {vatAmount > 0 ? (
            <>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>৳{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT ({vatRate}%):</span>
                <span>৳{vatAmount.toFixed(2)}</span>
              </div>
            </>
          ) : null}
          {discountVal > 0 ? (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-৳{discountVal.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between">
            <span>Grand Total:</span>
            <span>৳{totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid Amount:</span>
            <span>৳{(paidAmount === '' ? totalAmount : paidAmount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-black pt-1">
            <span>Due Balance:</span>
            <span>৳{dueAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-3" />

        <div className="text-center space-y-1 text-[9px] italic">
          <p>Thank you for shopping with us!</p>
          <p>পণ্য বিক্রয়ের ৩ দিনের মধ্যে পরিবর্তনযোগ্য।</p>
        </div>
      </div>

      {/* 4. MANUAL SEARCH DIALOG MODAL (F2) */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in no-print">
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl relative overflow-hidden space-y-4">
            <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
            
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center gap-1.5">
              <Search className="h-4.5 w-4.5 text-amber-500" />
              {language === 'en' ? 'Product Quick Search' : 'ম্যানুয়াল পণ্য অনুসন্ধান'}
            </h2>

            <div className="space-y-4">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={language === 'en' ? 'Search by name or category...' : 'পণ্যের নাম বা ক্যাটাগরি লিখে খুঁজুন...'}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
              />

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-xs text-neutral-500">
                    {searchQuery ? 'No matching products found' : 'Type to start searching...'}
                  </div>
                ) : (
                  searchResults.map((product, index) => (
                    <div
                      key={product.id}
                      onClick={() => selectManualSearchResult(product)}
                      className={`flex items-center justify-between p-3 rounded-xl border border-neutral-850 hover:border-amber-500/30 hover:bg-neutral-950 cursor-pointer transition-all ${
                        index === activeSearchIndex ? 'border-amber-500/30 bg-neutral-950 text-amber-400' : 'bg-neutral-900/40 text-neutral-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-neutral-200">{product.name}</div>
                        <div className="text-[10px] text-neutral-500 mt-0.5">{product.category}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-neutral-400">
                          ৳{product.movingAverageCost.toFixed(2)}
                        </div>
                        <div className="text-[9px] font-mono text-neutral-500 mt-0.5">
                          Stock: {product.currentStock} pcs
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setShowSearchModal(false);
                  setSearchQuery('');
                  setSearchResults([]);
                  barcodeInputRef.current?.focus();
                }}
                className="px-4 py-2.5 rounded-xl border border-neutral-800 hover:bg-neutral-950 text-xs font-semibold text-neutral-400 transition-colors cursor-pointer select-none"
              >
                {language === 'en' ? 'Close' : 'বন্ধ করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
