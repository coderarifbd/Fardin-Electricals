'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { searchProductsAction } from '@/lib/actions';
import { 
  Printer, 
  Search, 
  Barcode, 
  Plus, 
  Minus, 
  ArrowLeft,
  Grid,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  category: string;
  movingAverageCost: number;
  hasVariants?: boolean;
  variants?: {
    id: number;
    productId: number;
    name: string;
    barcode?: string | null;
    movingAverageCost: number;
  }[];
}

interface SelectedLabel {
  product: Product;
  variantId?: number | null;
  barcode: string;
  copies: number;
  price: number;
}

export default function BarcodeGeneratorPage() {
  const { language, toast } = useLanguage();
  
  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<SelectedLabel[]>([]);
  
  // Print configurations
  const [columnsCount, setColumnsCount] = useState<number>(4);
  const [showPrice, setShowPrice] = useState<boolean>(true);
  const [showShopName, setShowShopName] = useState<boolean>(true);

  // References
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await searchProductsAction(val);
      setSearchResults(results);
    } catch (e) {
      console.error(e);
    }
  };

  const addProductToLabels = (product: Product, variantId?: number | null) => {
    // Determine barcode value
    let barcodeValue = '';
    let labelName = product.name;
    let labelPrice = product.movingAverageCost * 1.25; // 25% markup default

    if (variantId) {
      const v = product.variants?.find(x => x.id === variantId);
      barcodeValue = v?.barcode || '';
      labelName = `${product.name} (${v?.name})`;
      labelPrice = (v?.movingAverageCost || product.movingAverageCost) * 1.25;
    } else {
      // In Fardin Electricals, products have barcodes directly or we generate one
      // Let's inspect product type
      const pAny = product as any;
      barcodeValue = pAny.barcode || `FARDIN${String(product.id).padStart(5, '0')}`;
    }

    if (!barcodeValue) {
      // Generate a fallback barcode if none exists
      barcodeValue = `FE-${String(product.id).padStart(5, '0')}`;
    }

    // Check if already added
    setSelectedLabels(prev => {
      const existsIdx = prev.findIndex(l => l.product.id === product.id && l.variantId === variantId);
      if (existsIdx !== -1) {
        return prev.map((l, idx) => idx === existsIdx ? { ...l, copies: l.copies + 10 } : l);
      }
      return [
        ...prev,
        {
          product,
          variantId: variantId || null,
          barcode: barcodeValue.toUpperCase().replace(/[^A-Z0-9-]/g, ''), // Code 39 safe
          copies: 10,
          price: parseFloat(labelPrice.toFixed(0))
        }
      ];
    });

    toast(
      language === 'en'
        ? `Added to label list: ${labelName}`
        : `তালিকায় যোগ হয়েছে: ${labelName}`,
      'success'
    );
  };

  const updateCopies = (index: number, delta: number) => {
    setSelectedLabels(prev => prev.map((l, idx) => {
      if (idx === index) {
        return { ...l, copies: Math.max(1, l.copies + delta) };
      }
      return l;
    }));
  };

  const updateLabelPrice = (index: number, newPrice: number) => {
    setSelectedLabels(prev => prev.map((l, idx) => 
      idx === index ? { ...l, price: newPrice } : l
    ));
  };

  const removeLabelRow = (index: number) => {
    setSelectedLabels(prev => prev.filter((_, idx) => idx !== index));
  };

  // Compile list of labels to render in grid
  const labelGridItems: SelectedLabel[] = [];
  selectedLabels.forEach(label => {
    for (let i = 0; i < label.copies; i++) {
      labelGridItems.push(label);
    }
  });

  const triggerPrint = () => {
    if (labelGridItems.length === 0) {
      toast(language === 'en' ? 'No labels to print' : 'প্রিন্ট করার মত কোনো লেবেল নেই!', 'error');
      return;
    }
    // Set layout print class on body
    document.body.classList.add('label-print-active');
    window.print();
    // Clean up class after print dialog is closed
    setTimeout(() => {
      document.body.classList.remove('label-print-active');
    }, 1000);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link 
              href="/products" 
              className="text-neutral-500 hover:text-neutral-300 transition-colors p-1 rounded-lg hover:bg-neutral-800"
            >
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
            <h1 className="text-xl font-bold font-sans">
              {language === 'en' ? 'Barcode Label Generator' : 'বারকোড লেবেল জেনারেটর'}
            </h1>
          </div>
          <p className="text-xs text-neutral-500">
            {language === 'en' 
              ? 'Generate sticker sheets for items using standard thermal label printers or sticker paper.' 
              : 'থার্মাল প্রিন্টার অথবা স্টিকার শিটে প্রিন্ট করার জন্য পণ্যের বারকোড স্টিকার তৈরি করুন।'}
          </p>
        </div>

        <button
          onClick={triggerPrint}
          disabled={labelGridItems.length === 0}
          className={`flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-bold transition-all ${
            labelGridItems.length === 0
              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-950/20 active:scale-[0.98] cursor-pointer'
          }`}
        >
          <Printer className="h-4.5 w-4.5" />
          {language === 'en' ? `Print Labels (${labelGridItems.length})` : `লেবেল প্রিন্ট করুন (${labelGridItems.length})`}
        </button>
      </div>

      {/* SETUP CONTENT AREA (Hidden during printing) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start no-print">
        
        {/* Left Side: Product Selection & Print Options */}
        <div className="space-y-6 lg:col-span-1">
          {/* Options Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4 shadow-xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 border-b border-neutral-800 pb-3">
              <Grid className="h-4 w-4 text-purple-400" />
              {language === 'en' ? 'Sticker Sheet Setup' : 'স্টিকার লেআউট সেটআপ'}
            </h2>

            <div className="space-y-3.5 text-xs">
              {/* Columns Count Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">
                  {language === 'en' ? 'Columns in Row' : 'প্রতি লাইনে স্টিকার সংখ্যা'}
                </label>
                <select
                  value={columnsCount}
                  onChange={(e) => setColumnsCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value={1}>1 Column (Individual labels / thermal)</option>
                  <option value={2}>2 Columns</option>
                  <option value={3}>3 Columns (Standard A4 Sticker sheet)</option>
                  <option value={4}>4 Columns</option>
                  <option value={5}>5 Columns</option>
                </select>
              </div>

              {/* Show Shop Name Checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-neutral-850 bg-neutral-950/20 hover:bg-neutral-950/40 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={showShopName}
                  onChange={(e) => setShowShopName(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-550"
                />
                <div>
                  <span className="font-bold text-neutral-200 block">
                    {language === 'en' ? 'Print Shop Name' : 'দোকানের নাম প্রিন্ট করুন'}
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    Prints &quot;Fardin Electricals&quot; above barcode.
                  </span>
                </div>
              </label>

              {/* Show Price Checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-xl border border-neutral-850 bg-neutral-950/20 hover:bg-neutral-950/40 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="h-4.5 w-4.5 rounded border-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer accent-purple-550"
                />
                <div>
                  <span className="font-bold text-neutral-200 block">
                    {language === 'en' ? 'Print Retail Price' : 'খুচরা বিক্রয় মূল্য প্রিন্ট করুন'}
                  </span>
                  <span className="text-[9px] text-neutral-500 block mt-0.5">
                    Prints MRP price on the label sticker.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Product Finder Card */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 space-y-4 shadow-xl">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 border-b border-neutral-800 pb-3">
              <Search className="h-4 w-4 text-purple-400" />
              {language === 'en' ? 'Find Product to Add' : 'পণ্য সার্চ করুন'}
            </h2>

            <div className="space-y-4">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={language === 'en' ? 'Search by name or category...' : 'পণ্যের নাম লিখে সার্চ করুন...'}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 pl-10 text-sm text-neutral-200 outline-none focus:border-purple-500"
                />
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
              </div>

              {/* Suggestions dropdown inside card */}
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {searchResults.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-neutral-600">
                    {searchQuery ? 'No matching products found' : 'Type to search products...'}
                  </div>
                ) : (
                  searchResults.map(p => (
                    <div key={p.id} className="border border-neutral-850 rounded-xl p-2.5 bg-neutral-950/40 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-neutral-300">{p.name}</div>
                          <div className="text-[10px] text-neutral-500">{p.category}</div>
                        </div>
                        
                        {!p.variants || p.variants.length === 0 ? (
                          <button
                            onClick={() => addProductToLabels(p)}
                            className="bg-purple-950 hover:bg-purple-900 border border-purple-900 text-purple-400 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                          >
                            + Add
                          </button>
                        ) : null}
                      </div>

                      {p.variants && p.variants.length > 0 && (
                        <div className="space-y-1 pt-1.5 border-t border-neutral-800/80">
                          {p.variants.map(v => (
                            <div key={v.id} className="flex items-center justify-between pl-2 text-[10px] text-neutral-450 hover:text-neutral-200">
                              <span>↳ {v.name}</span>
                              <button
                                onClick={() => addProductToLabels(p, v.id)}
                                className="bg-purple-950/50 hover:bg-purple-900/50 border border-purple-900/30 text-purple-400 px-1.5 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer"
                              >
                                + Add
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Selected labels list */}
        <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 shadow-xl space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3 flex items-center gap-1.5">
            <Barcode className="h-4.5 w-4.5 text-purple-400" />
            {language === 'en' ? 'Labels Sticker Sheet List' : 'লেবেল প্রিন্টিং শিট তালিকা'}
            <span className="ml-auto text-xs font-mono text-neutral-500 bg-neutral-950 border border-neutral-850 px-2.5 py-0.5 rounded-lg">
              {selectedLabels.length} unique items
            </span>
          </h2>

          {selectedLabels.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-neutral-600 gap-2 text-center">
              <Barcode className="h-12 w-12 text-neutral-700 stroke-[1.2]" />
              <div className="text-xs font-semibold">{language === 'en' ? 'No items in label sheet list.' : 'তালিকায় কোনো লেবেল যুক্ত করা হয়নি।'}</div>
              <p className="text-[10px] text-neutral-500 max-w-xs leading-normal">
                {language === 'en' ? 'Search and select products on the left side to compile your sticker print layout.' : 'স্টিকার প্রিন্ট করতে বাম পাশের সার্চ বার থেকে পণ্য যোগ করুন।'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/60 pr-1 max-h-[480px] overflow-y-auto">
              {selectedLabels.map((label, index) => {
                const labelName = label.variantId 
                  ? `${label.product.name} (${label.product.variants?.find(v => v.id === label.variantId)?.name})`
                  : label.product.name;
                
                return (
                  <div key={`${label.product.id}-${label.variantId}`} className="flex flex-col sm:flex-row sm:items-center justify-between py-4 first:pt-0 last:pb-0 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-neutral-200">{labelName}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-neutral-500 bg-neutral-950 border border-neutral-850 px-1.5 py-0.5 rounded">
                          Code: {label.barcode}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-500">
                          {label.product.category}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      {/* Price modifier */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-neutral-500 uppercase text-[9px] font-bold">MRP:</span>
                        <div className="flex items-center gap-1 bg-neutral-950 border border-neutral-850 rounded-xl px-2 py-1 w-20 shrink-0">
                          <span className="text-neutral-500 font-mono">৳</span>
                          <input
                            type="number"
                            value={label.price}
                            onChange={(e) => updateLabelPrice(index, parseInt(e.target.value) || 0)}
                            className="w-full bg-transparent border-0 outline-none text-right font-mono text-xs text-neutral-200"
                          />
                        </div>
                      </div>

                      {/* Quantity / copies selector */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateCopies(index, -5)}
                          className="h-7 w-7 rounded-lg border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all select-none cursor-pointer"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          value={label.copies}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setSelectedLabels(prev => prev.map((l, idx) => idx === index ? { ...l, copies: val } : l));
                          }}
                          className="w-12 bg-transparent border-0 outline-none text-center text-xs font-bold font-mono text-neutral-100"
                        />
                        <button
                          onClick={() => updateCopies(index, 5)}
                          className="h-7 w-7 rounded-lg border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800 text-neutral-400 flex items-center justify-center transition-all select-none cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <button
                        onClick={() => removeLabelRow(index)}
                        className="text-neutral-600 hover:text-rose-500 p-1.5 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PRINT CONTAINER PREVIEW (Always visible during print, hidden during setup screen via media query) */}
      <div className="label-print-sheet hidden print:block bg-white text-black min-h-screen p-4">
        <div 
          className="grid gap-3 gap-y-6 justify-center mx-auto"
          style={{ 
            gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))`,
            width: '100%' 
          }}
        >
          {labelGridItems.map((item, idx) => {
            const displayName = item.variantId 
              ? `${item.product.name} (${item.product.variants?.find(v => v.id === item.variantId)?.name})`
              : item.product.name;
            return (
              <div 
                key={idx} 
                className="flex flex-col items-center justify-center border border-dashed border-gray-300 p-2.5 bg-white text-black text-center overflow-hidden break-inside-avoid"
                style={{ 
                  height: '35mm', 
                  width: '100%',
                  fontSize: '9px',
                  lineHeight: '1.2' 
                }}
              >
                {/* Shop Title */}
                {showShopName && (
                  <div className="text-[7px] font-black uppercase tracking-wider text-gray-700 font-sans">
                    Fardin Electricals
                  </div>
                )}
                
                {/* Product Name */}
                <div className="font-extrabold text-[8px] truncate w-full max-w-[150px] font-sans mt-0.5">
                  {displayName}
                </div>

                {/* Barcode Rendered via Libre Barcode 39 */}
                <div className="font-barcode text-3xl font-normal leading-none mt-2.5 mb-1.5 select-none tracking-normal">
                  *{item.barcode}*
                </div>

                {/* Barcode Code & Price Info */}
                <div className="flex items-center justify-between w-full px-2 text-[7px] font-mono text-gray-800">
                  <span>{item.barcode}</span>
                  {showPrice && (
                    <span className="font-bold font-sans border border-black rounded px-1 scale-95 origin-right">
                      MRP: ৳{item.price}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
