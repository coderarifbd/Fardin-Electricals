'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { getProductsAction } from '@/lib/actions';
import { 
  Search, 
  ShoppingBag, 
  Layers, 
  AlertTriangle, 
  TrendingUp, 
  Barcode, 
  Calendar,
  LayoutGrid,
  List
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  barcode?: string | null;
  priceHistory?: { date: string; price: number }[];
}

export default function ProductsPage() {
  const { language, t } = useLanguage();
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await getProductsAction();
        setProductsList(data);
      } catch (err) {
        console.error('Failed to load products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const categories = ['ALL', ...Array.from(new Set(productsList.map(p => p.category)))];

  const filteredProducts = productsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery));
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-amber-500" />
            {language === 'en' ? 'Product Inventory Directory' : 'পণ্য স্টক ও মূল্য তালিকা'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' 
              ? 'Read-only directory. Products are automatically added through purchase/sales invoice entries.' 
              : 'স্টক ও গড় ক্রয়মূল্য তালিকা। পণ্য শুধুমাত্র এন্ট্রি ফর্মে ইনভয়েস জেনারেট করার সময় অটোমেটিক যুক্ত হবে।'}
          </p>
        </div>
      </div>

      {/* Filters, Search & View Mode Toggler */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
          <input
            type="text"
            placeholder={language === 'en' ? 'Search by name or barcode...' : 'পণ্যের নাম বা বারকোড দিয়ে খুঁজুন...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-850 bg-neutral-900/60 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
          {/* Category dropdown */}
          <div className="relative w-40 sm:w-48 shrink-0">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-850 bg-neutral-900/60 text-xs text-neutral-200 outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="bg-neutral-950 text-neutral-300">
                  {cat === 'ALL' ? (language === 'en' ? 'All Categories' : 'সব ক্যাটাগরি') : cat}
                </option>
              ))}
            </select>
          </div>

          {/* Grid/List View Toggler */}
          <div className="flex rounded-xl border border-neutral-850 bg-neutral-900/60 p-1 select-none">
            <button
              onClick={() => setViewMode('GRID')}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === 'GRID'
                  ? 'bg-amber-500 text-black'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title={language === 'en' ? 'Grid View' : 'গ্রিড ভিউ'}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === 'LIST'
                  ? 'bg-amber-500 text-black'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title={language === 'en' ? 'List View' : 'লিস্ট ভিউ'}
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Products Display Container */}
      {loading ? (
        <div className="text-center py-20 text-xs text-neutral-500">
          {t('loading')}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-20 text-center text-xs text-neutral-500">
          {language === 'en' ? 'No products registered in the system.' : 'কোনো পণ্য তালিকাভুক্ত নেই।'}
        </div>
      ) : viewMode === 'GRID' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isLowStock = p.currentStock <= p.minStockAlert;
            const isNegative = p.currentStock < 0;
            
            return (
              <div 
                key={p.id}
                className="rounded-2xl border border-neutral-850 bg-neutral-900/30 p-5 space-y-4 hover:border-neutral-800 transition-all relative overflow-hidden flex flex-col justify-between"
              >
                {/* Product Meta Header */}
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 bg-neutral-950 px-2.5 py-0.5 rounded border border-neutral-900">
                      {p.category}
                    </span>
                    
                    {p.barcode && (
                      <span className="text-[9px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-850 rounded px-1.5 py-0.5 flex items-center gap-1 select-all" title="Barcode">
                        <Barcode className="h-3 w-3 text-amber-500" />
                        {p.barcode}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-neutral-200 tracking-tight leading-tight select-text">
                    {p.name}
                  </h3>
                </div>

                {/* Stock & Cost Metrics */}
                <div className="grid grid-cols-2 gap-4 bg-neutral-950/40 p-3 rounded-xl border border-neutral-900/60">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-neutral-500 uppercase font-semibold block">
                      {language === 'en' ? 'Current Stock' : 'বর্তমান স্টক'}
                    </span>
                    <span className={`text-sm font-black font-mono flex items-center gap-1 ${
                      isNegative 
                        ? 'text-rose-500' 
                        : isLowStock 
                        ? 'text-amber-500' 
                        : 'text-emerald-500'
                    }`}>
                      {p.currentStock} pcs
                      {isLowStock && (
                        <span title="Low Stock Warning">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] text-neutral-500 uppercase font-semibold block">
                      {language === 'en' ? 'Avg Cost' : 'গড় ক্রয়মূল্য'}
                    </span>
                    <span className="text-sm font-bold text-neutral-300 font-mono">
                      ৳{p.movingAverageCost.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Price History Toggle */}
                {p.priceHistory && p.priceHistory.length > 0 ? (
                  <div className="border-t border-neutral-900/80 pt-3">
                    <button
                      onClick={() => setExpandedHistoryId(expandedHistoryId === p.id ? null : p.id)}
                      className="w-full flex items-center justify-between text-[10px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors uppercase tracking-wider font-semibold"
                    >
                      <span>{language === 'en' ? 'Purchase Cost History' : 'পূর্ববর্তী ক্রয়মূল্য রেকর্ড'}</span>
                      <span className="text-xs">{expandedHistoryId === p.id ? '−' : '+'}</span>
                    </button>

                    {expandedHistoryId === p.id && (
                      <div className="mt-2.5 space-y-1.5 animate-slide-in">
                        {p.priceHistory.map((h, hIdx) => (
                          <div 
                            key={hIdx} 
                            className="flex justify-between items-center text-[10px] font-mono text-neutral-500 bg-neutral-950/60 p-1.5 rounded"
                          >
                            <span className="flex items-center gap-1">
                              <Calendar className="h-2.5 w-2.5 text-neutral-650" />
                              {h.date}
                            </span>
                            <span className="font-bold text-amber-500">৳{h.price.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-neutral-900/80 pt-3 text-[10px] text-neutral-600 italic">
                    {language === 'en' ? 'No cost history recorded.' : 'ক্রয়মূল্যের কোনো পূর্ববর্তী রেকর্ড নেই।'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-2xl border border-neutral-850 bg-neutral-900/30 p-6 shadow-2xl backdrop-blur-md overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/40 font-semibold text-neutral-400">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3 w-40">{language === 'en' ? 'Barcode' : 'বারকোড'}</th>
                <th className="p-3">{language === 'en' ? 'Product Name' : 'পণ্যের নাম'}</th>
                <th className="p-3 w-36">{language === 'en' ? 'Category' : 'ক্যাটাগরি'}</th>
                <th className="p-3 text-right w-36">{language === 'en' ? 'Current Stock' : 'বর্তমান স্টক'}</th>
                <th className="p-3 text-right w-40">{language === 'en' ? 'Avg Cost' : 'গড় ক্রয়মূল্য'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => {
                const isLowStock = p.currentStock <= p.minStockAlert;
                const isNegative = p.currentStock < 0;

                return (
                  <tr 
                    key={p.id} 
                    className="border-b border-neutral-800/60 hover:bg-neutral-900/15 transition-colors"
                  >
                    <td className="p-3 text-center text-neutral-500 font-mono">{idx + 1}</td>
                    <td className="p-3 font-mono text-neutral-400 select-all">
                      {p.barcode ? (
                        <span className="flex items-center gap-1.5">
                          <Barcode className="h-3.5 w-3.5 text-amber-500/80" />
                          {p.barcode}
                        </span>
                      ) : (
                        <span className="text-neutral-700">—</span>
                      )}
                    </td>
                    <td className="p-3 font-bold text-neutral-200">{p.name}</td>
                    <td className="p-3">
                      <span className="bg-neutral-950 border border-neutral-850 px-2 py-0.5 rounded text-[10px] text-neutral-400 font-semibold uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      <span className={`flex items-center justify-end gap-1 ${
                        isNegative 
                          ? 'text-rose-500' 
                          : isLowStock 
                          ? 'text-amber-500' 
                          : 'text-emerald-500'
                      }`}>
                        {p.currentStock} pcs
                        {isLowStock && (
                          <span title="Low Stock Warning">
                            <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-neutral-300">
                      ৳{p.movingAverageCost.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
