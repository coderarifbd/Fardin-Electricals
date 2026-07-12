'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/context/LanguageContext';
import { 
  searchProductsAction, 
  addQuickProductAction, 
  saveInvoiceAction,
  getPartiesAction,
  getInvoiceAction,
  getInvoiceItemsAction,
  updateInvoiceAction,
  getNextInvoiceNoAction
} from '@/lib/actions';
import { 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Keyboard, 
  DollarSign, 
  Save, 
  User, 
  Calendar, 
  FileText 
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  priceHistory?: { date: string; price: number }[];
  hasVariants?: boolean;
  variants?: {
    id: number;
    productId: number;
    name: string;
    currentStock: number;
    minStockAlert: number;
    movingAverageCost: number;
    barcode?: string | null;
    imageUrl?: string | null;
  }[];
}

interface ItemRow {
  tempId: number;
  product: Product | null;
  selectedVariantId?: number | null;
  typedName: string;
  quantity: number;
  unitPrice: number;
  showSuggestions: boolean;
  suggestions: Product[];
  activeSuggestionIndex: number;
}

export default function EntryForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, t, toast } = useLanguage();

  // URL type checking
  const initialType = searchParams.get('type') === 'PURCHASE' ? 'PURCHASE' : 'SALES';
  const [invoiceType, setInvoiceType] = useState<'SALES' | 'PURCHASE'>(initialType);

  // Form metadata
  const [manualInvoiceNo, setManualInvoiceNo] = useState('');
  const [invoiceNoAutoSuggested, setInvoiceNoAutoSuggested] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [partyName, setPartyName] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);

  // Load invoice data for editing
  useEffect(() => {
    const editIdParam = searchParams.get('edit');
    if (editIdParam) {
      const invId = parseInt(editIdParam);
      if (!isNaN(invId)) {
        setIsEditing(true);
        setEditInvoiceId(invId);
        
        async function loadInvoiceData() {
          try {
            const invoice = await getInvoiceAction(invId);
            if (!invoice) {
              toast(language === 'en' ? 'Invoice not found' : 'ইনভয়েস পাওয়া যায়নি', 'error');
              router.push('/entry');
              return;
            }
            
            // Populate form metadata
            setInvoiceType(invoice.invoiceType as any);
            setManualInvoiceNo(invoice.manualInvoiceNo);
            setInvoiceDate(invoice.invoiceDate);
            setPartyName(invoice.partyName);
            setPaidAmount(invoice.paidAmount);
            setExpectedPaymentDate(invoice.expectedPaymentDate || '');
            
            // Populate items
            const itemList = await getInvoiceItemsAction(invId);
            const mappedRows = itemList.map((item: any, idx: number) => ({
              tempId: idx + 1,
              product: {
                id: item.productId,
                name: item.productName,
                category: 'General',
                movingAverageCost: item.unitPrice,
                currentStock: 0,
                minStockAlert: 0
              },
              typedName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              showSuggestions: false,
              suggestions: [],
              activeSuggestionIndex: 0
            }));
            
            setRows(mappedRows.length > 0 ? mappedRows : [
              {
                tempId: Date.now(),
                product: null,
                typedName: '',
                quantity: 1,
                unitPrice: 0,
                showSuggestions: false,
                suggestions: [],
                activeSuggestionIndex: 0
              }
            ]);
            
            // Resolve active details for each product
            for (let i = 0; i < mappedRows.length; i++) {
              const rowItem = mappedRows[i];
              try {
                const searchResults = await searchProductsAction(rowItem.typedName);
                const exactProd = searchResults.find(p => p.id === rowItem.product.id);
                if (exactProd) {
                  setRows(prev => prev.map((r, idx) => {
                    if (idx === i) {
                      return {
                        ...r,
                        product: exactProd as any
                      };
                    }
                    return r;
                  }));
                }
              } catch (err) {
                console.error('Error fetching details for item index:', i, err);
              }
            }
            
          } catch (err) {
            console.error('Error loading edit invoice:', err);
            toast('Failed to load invoice details', 'error');
          }
        }
        
        loadInvoiceData();
      }
    } else {
      setIsEditing(false);
      setEditInvoiceId(null);
    }
  }, [searchParams]);

  // Party Autocomplete lists
  const [partiesList, setPartiesList] = useState<{ id: number; name: string; phone?: string | null; address?: string | null }[]>([]);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);

  // Fetch parties list on type change
  useEffect(() => {
    async function loadParties() {
      try {
        const list = await getPartiesAction(invoiceType === 'SALES' ? 'CUSTOMER' : 'SUPPLIER');
        setPartiesList(list as any);
      } catch (err) {
        console.error(err);
      }
    }
    loadParties();
  }, [invoiceType]);

  // Item Grid
  const [rows, setRows] = useState<ItemRow[]>([
    {
      tempId: 1,
      product: null,
      typedName: '',
      quantity: 1,
      unitPrice: 0,
      showSuggestions: false,
      suggestions: [],
      activeSuggestionIndex: 0
    }
  ]);

  // Quick Add State
  const [quickAdd, setQuickAdd] = useState<{
    isOpen: boolean;
    rowIndex: number;
    name: string;
    category: string;
    minStock: number;
    unitCost: number;
  }>({
    isOpen: false,
    rowIndex: -1,
    name: '',
    category: '',
    minStock: 5,
    unitCost: 0
  });

  // Today's date default
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setInvoiceDate(today);
  }, []);

  // Update invoice type if query parameter changes
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'SALES' || typeParam === 'PURCHASE') {
      setInvoiceType(typeParam);
    }
  }, [searchParams]);

  // Auto-suggest next invoice number whenever type changes (skip in edit mode)
  useEffect(() => {
    if (isEditing) return;
    async function fetchNextNo() {
      try {
        const suggested = await getNextInvoiceNoAction(invoiceType);
        if (suggested) {
          setManualInvoiceNo(suggested);
          setInvoiceNoAutoSuggested(true);
        } else {
          setManualInvoiceNo('');
          setInvoiceNoAutoSuggested(false);
        }
      } catch (err) {
        console.error('Could not fetch next invoice no:', err);
      }
    }
    fetchNextNo();
  }, [invoiceType, isEditing]);

  // Calculate totals
  const totalAmount = rows.reduce((sum, row) => sum + (row.quantity * row.unitPrice || 0), 0);
  const calculatedDueAmount = Math.max(0, totalAmount - (typeof paidAmount === 'number' ? paidAmount : totalAmount));

  // Keyboard navigation focus handler
  const focusCell = (rowIndex: number, colName: 'product' | 'qty' | 'price') => {
    setTimeout(() => {
      const el = document.getElementById(`cell-${rowIndex}-${colName}`);
      if (el) {
        (el as HTMLInputElement).focus();
        if (colName === 'qty' || colName === 'price') {
          (el as HTMLInputElement).select();
        }
      }
    }, 50);
  };

  // 1. SUGGESTION FETCHING
  const handleProductSearch = async (rowIndex: number, value: string) => {
    setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, typedName: value } : r));

    if (value.trim().length === 0) {
      setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, suggestions: [], showSuggestions: false } : r));
      return;
    }

    try {
      const results = await searchProductsAction(value);
      
      // Barcode matching logic: if scanner matches exact barcode, auto select and return
      const barcodeMatch = results.find(p => p.barcode === value.trim());
      if (barcodeMatch) {
        selectProduct(rowIndex, barcodeMatch);
        return;
      }

      setRows(prev => prev.map((r, idx) => {
        if (idx === rowIndex) {
          const hasSuggestions = results.length > 0;
          return {
            ...r,
            suggestions: results,
            showSuggestions: invoiceType === 'PURCHASE' ? true : hasSuggestions,
            activeSuggestionIndex: 0
          };
        }
        return r;
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // 2. PRODUCT SELECTION
  const selectProduct = (rowIndex: number, product: Product) => {
    setRows(prev => prev.map((r, idx) => {
      if (idx === rowIndex) {
        const firstVariant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
        const defaultPrice = firstVariant 
          ? (invoiceType === 'SALES' ? firstVariant.movingAverageCost * 1.25 : firstVariant.movingAverageCost)
          : (invoiceType === 'SALES' ? product.movingAverageCost * 1.25 : product.movingAverageCost);
        return {
          ...r,
          product,
          selectedVariantId: firstVariant ? firstVariant.id : null,
          typedName: product.name,
          unitPrice: parseFloat(defaultPrice.toFixed(2)),
          showSuggestions: false,
          suggestions: []
        };
      }
      return r;
    }));
    focusCell(rowIndex, 'qty');
  };

  // 3. REMOVE ROW
  const removeRow = (rowIndex: number) => {
    if (rows.length === 1) {
      setRows([
        {
          tempId: Date.now(),
          product: null,
          selectedVariantId: null,
          typedName: '',
          quantity: 1,
          unitPrice: 0,
          showSuggestions: false,
          suggestions: [],
          activeSuggestionIndex: 0
        }
      ]);
      return;
    }
    setRows(prev => prev.filter((_, idx) => idx !== rowIndex));
  };

  // 4. ADD NEW ROW
  const appendBlankRow = () => {
    const nextId = Date.now();
    const lastRow = rows[rows.length - 1];
    const prevProduct = lastRow ? lastRow.product : null;
    
    let nextVariantId = null;
    let nextUnitPrice = 0;
    if (prevProduct && prevProduct.variants && prevProduct.variants.length > 0) {
      const prevVarIdx = prevProduct.variants.findIndex(v => v.id === lastRow.selectedVariantId);
      const nextVarIdx = prevVarIdx !== -1 ? (prevVarIdx + 1) % prevProduct.variants.length : 0;
      const nextVar = prevProduct.variants[nextVarIdx];
      nextVariantId = nextVar.id;
      const price = invoiceType === 'SALES' ? nextVar.movingAverageCost * 1.25 : nextVar.movingAverageCost;
      nextUnitPrice = parseFloat(price.toFixed(2));
    } else if (prevProduct) {
      nextUnitPrice = lastRow ? lastRow.unitPrice : prevProduct.movingAverageCost;
    }

    setRows(prev => [
      ...prev,
      {
        tempId: nextId,
        product: prevProduct,
        selectedVariantId: nextVariantId,
        typedName: prevProduct ? prevProduct.name : '',
        quantity: 1,
        unitPrice: nextUnitPrice,
        showSuggestions: false,
        suggestions: [],
        activeSuggestionIndex: 0
      }
    ]);
    
    const nextRowIdx = rows.length;
    if (prevProduct) {
      focusCell(nextRowIdx, 'qty');
    } else {
      focusCell(nextRowIdx, 'product');
    }
  };

  // 5. IN-LINE QUICK ADD POP OVER
  const triggerQuickAdd = (rowIndex: number, name: string) => {
    setQuickAdd({
      isOpen: true,
      rowIndex,
      name,
      category: 'General',
      minStock: 5,
      unitCost: 0
    });
    setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, showSuggestions: false } : r));
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAdd.name || !quickAdd.category) {
      toast(t('allFieldsRequired'), 'error');
      return;
    }

    try {
      const newProd = await addQuickProductAction(
        quickAdd.name,
        quickAdd.category,
        quickAdd.minStock,
        quickAdd.unitCost
      );

      toast(t('successProduct'), 'success');

      // Update row
      setRows(prev => prev.map((r, idx) => {
        if (idx === quickAdd.rowIndex) {
          return {
            ...r,
            product: newProd as any,
            typedName: newProd.name,
            unitPrice: invoiceType === 'SALES' ? newProd.movingAverageCost * 1.25 : newProd.movingAverageCost,
            showSuggestions: false,
            suggestions: []
          };
        }
        return r;
      }));

      const ri = quickAdd.rowIndex;
      setQuickAdd({ isOpen: false, rowIndex: -1, name: '', category: '', minStock: 5, unitCost: 0 });
      focusCell(ri, 'qty');
    } catch (err: any) {
      toast(err.message || 'Error creating product', 'error');
    }
  };

  // 6. SAVE INVOICE
  const handleSaveInvoice = async () => {
    if (isSubmitting) return;

    if (!manualInvoiceNo || !invoiceDate || !partyName) {
      toast(t('allFieldsRequired'), 'error');
      return;
    }

    const hasInvalidRow = rows.some(r => r.typedName.trim() !== '' && r.product === null);
    if (hasInvalidRow) {
      toast(
        language === 'en' 
          ? 'One or more rows have invalid or unselected products. Please select a product or remove the row.' 
          : 'এক বা একাধিক সারিতে সঠিক পণ্য সিলেক্ট করা হয়নি। দয়া করে সঠিক পণ্য সিলেক্ট করুন অথবা সারিটি মুছে দিন।', 
        'error'
      );
      return;
    }

    const validItems = rows.filter(r => r.product !== null && r.quantity > 0);
    if (validItems.length === 0) {
      toast(language === 'en' ? 'Add at least one product with quantity > 0' : 'পরিমাণ সহ অন্তত একটি পণ্য যোগ করুন', 'error');
      return;
    }

    setIsSubmitting(true);

    const invoicePayload = {
      invoiceType,
      manualInvoiceNo,
      invoiceDate,
      partyName,
      totalAmount,
      paidAmount: paidAmount === '' ? totalAmount : paidAmount,
      dueAmount: calculatedDueAmount,
      expectedPaymentDate: calculatedDueAmount > 0 ? expectedPaymentDate : null
    };

    const itemPayload = validItems.map(item => ({
      productId: item.product!.id,
      variantId: item.selectedVariantId || null,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));

    try {
      if (isEditing && editInvoiceId !== null) {
        await updateInvoiceAction(editInvoiceId, invoicePayload, itemPayload);
        toast(language === 'en' ? 'Invoice updated successfully!' : 'ইনভয়েস সফলভাবে সংশোধিত হয়েছে!', 'success');
      } else {
        await saveInvoiceAction(invoicePayload, itemPayload);
        toast(t('successInvoice'), 'success');
      }
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // Reset State
      setManualInvoiceNo('');
      setPartyName('');
      setPaidAmount('');
      setExpectedPaymentDate('');
      setRows([
        {
          tempId: Date.now(),
          product: null,
          selectedVariantId: null,
          typedName: '',
          quantity: 1,
          unitPrice: 0,
          showSuggestions: false,
          suggestions: [],
          activeSuggestionIndex: 0
        }
      ]);
      
      if (isEditing) {
        router.push('/search');
      } else {
        focusCell(0, 'product');
      }
    } catch (err: any) {
      toast(err.message || 'Failed to save invoice', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Global Ctrl + Enter listener
  useEffect(() => {
    const handleGlobalSave = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSaveInvoice();
      }
    };
    window.addEventListener('keydown', handleGlobalSave);
    return () => window.removeEventListener('keydown', handleGlobalSave);
  }, [rows, manualInvoiceNo, invoiceDate, partyName, paidAmount, invoiceType, isSubmitting, isEditing, editInvoiceId]);

  return (
    <div className="space-y-6">
      {/* Keyboard Helper Warning */}
      <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
        <Keyboard className="h-5 w-5 text-amber-500 shrink-0" />
        <p className="leading-relaxed">
          <span className="font-semibold text-neutral-200">UX Alert:</span> {t('itemGridHelp')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* LEFT & CENTER: Invoice Form */}
        <div className="lg:col-span-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm overflow-hidden shadow-xl">
          <div className={`h-2 w-full ${invoiceType === 'SALES' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-blue-500 to-indigo-400'}`} />
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${invoiceType === 'SALES' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
                <h1 className="text-xl font-bold tracking-wide font-sans">
                  {isEditing 
                    ? (language === 'en' ? 'Edit Invoice' : 'ইনভয়েস সংশোধন (Edit)')
                    : (invoiceType === 'SALES' ? t('sales') + ' ' + (language === 'en' ? 'Invoice Entry' : 'বিল এন্ট্রি') : t('purchase') + ' ' + (language === 'en' ? 'Invoice Entry' : 'বিল এন্ট্রি'))
                  }
                </h1>
              </div>

              <div className="flex rounded-xl border border-neutral-800 bg-neutral-950 p-1">
                <button
                  onClick={() => {
                    setInvoiceType('SALES');
                    router.push('/entry?type=SALES' + (isEditing ? `&edit=${editInvoiceId}` : ''));
                  }}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    invoiceType === 'SALES'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {t('sales')}
                </button>
                <button
                  onClick={() => {
                    setInvoiceType('PURCHASE');
                    router.push('/entry?type=PURCHASE' + (isEditing ? `&edit=${editInvoiceId}` : ''));
                  }}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    invoiceType === 'PURCHASE'
                      ? 'bg-blue-950/80 text-blue-400 border border-blue-800/50'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {t('purchase')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('invoiceDate')}
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  {t('invoiceNo')}
                  {invoiceNoAutoSuggested && !isEditing && (
                    <span className="ml-auto text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      auto
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  placeholder="e.g. S-102 or P-205"
                  value={manualInvoiceNo}
                  onChange={(e) => {
                    setManualInvoiceNo(e.target.value);
                    setInvoiceNoAutoSuggested(false);
                  }}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500 transition-colors font-mono"
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {t('partyName')}
                </label>
                <input
                  type="text"
                  placeholder={invoiceType === 'SALES' ? 'Customer Name' : 'Supplier Name'}
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  onFocus={() => setShowPartySuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowPartySuggestions(false), 200);
                  }}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500 transition-colors"
                />
                {showPartySuggestions && partiesList.filter(p => p.name.toLowerCase().includes(partyName.toLowerCase())).length > 0 && (
                  <div className="absolute left-0 right-0 top-[70px] z-50 max-h-40 overflow-y-auto rounded-xl border border-neutral-850 bg-neutral-900 shadow-2xl p-1 text-xs">
                    {partiesList
                      .filter(p => p.name.toLowerCase().includes(partyName.toLowerCase()))
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => setPartyName(p.name)}
                          className="px-3 py-2 hover:bg-neutral-800 hover:text-amber-400 text-neutral-300 rounded-lg cursor-pointer transition-colors"
                        >
                          {p.name} {p.phone ? `(${p.phone})` : ''}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/40">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/80 font-semibold text-neutral-400">
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3 w-[45%]">{t('productName')}</th>
                    <th className="p-3 text-center w-24">{t('quantity')}</th>
                    <th className="p-3 text-right w-36">{t('unitPrice')}</th>
                    <th className="p-3 text-right w-36">{language === 'en' ? 'Line Total' : 'উপমোট'}</th>
                    <th className="p-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const lineTotal = (row.quantity * row.unitPrice) || 0;
                    const selectedVar = row.product?.variants?.find(v => v.id === row.selectedVariantId);
                    const currentStock = selectedVar ? selectedVar.currentStock : (row.product ? row.product.currentStock : 0);
                    const willGoNegative = invoiceType === 'SALES' && row.product && (currentStock < row.quantity);

                    return (
                      <tr 
                        key={row.tempId} 
                        className="border-b border-neutral-800/60 hover:bg-neutral-900/10 transition-colors relative"
                      >
                        <td className="p-3 text-center text-neutral-500 font-mono text-xs">{rowIndex + 1}</td>
                        
                        <td className="p-3 relative">
                          <div className="flex items-center gap-2">
                            {willGoNegative && (
                              <div className="relative group shrink-0">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 hidden group-hover:block bg-amber-950 border border-amber-800 text-amber-300 text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap z-50 shadow-lg">
                                  {row.product!.currentStock} in stock (warning)
                                </span>
                              </div>
                            )}
                            <input
                              id={`cell-${rowIndex}-product`}
                              type="text"
                              autoComplete="off"
                              placeholder={language === 'en' ? 'Type product name...' : 'পণ্যের নাম লিখুন...'}
                              value={row.typedName}
                              onFocus={(e) => {
                                e.target.select();
                                setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, showSuggestions: r.suggestions.length > 0 } : r));
                              }}
                              onChange={(e) => handleProductSearch(rowIndex, e.target.value)}
                              onBlur={() => {
                                setTimeout(() => {
                                  setRows(prev => prev.map((r, idx) => {
                                    if (idx === rowIndex) {
                                      let newTypedName = r.typedName;
                                      if (r.product !== null) {
                                        newTypedName = r.product.name;
                                      } else if (invoiceType === 'SALES') {
                                        newTypedName = '';
                                      }
                                      return { 
                                        ...r, 
                                        showSuggestions: false,
                                        typedName: newTypedName
                                      };
                                    }
                                    return r;
                                  }));
                                }, 200);
                              }}
                              onKeyDown={(e) => {
                                const currentSuggestions = row.suggestions;
                                const maxIndex = invoiceType === 'PURCHASE' ? currentSuggestions.length + 1 : currentSuggestions.length;
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setRows(prev => prev.map((r, idx) => {
                                    if (idx === rowIndex && r.showSuggestions && maxIndex > 0) {
                                      const nextIndex = (r.activeSuggestionIndex + 1) % maxIndex;
                                      return { ...r, activeSuggestionIndex: nextIndex };
                                    }
                                    return r;
                                  }));
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setRows(prev => prev.map((r, idx) => {
                                    if (idx === rowIndex && r.showSuggestions && maxIndex > 0) {
                                      const prevIndex = (r.activeSuggestionIndex - 1 + maxIndex) % maxIndex;
                                      return { ...r, activeSuggestionIndex: prevIndex };
                                    }
                                    return r;
                                  }));
                                } else if (e.key === 'Enter') {
                                  if (row.showSuggestions && maxIndex > 0) {
                                    e.preventDefault();
                                    const activeIdx = row.activeSuggestionIndex;
                                    if (activeIdx < currentSuggestions.length) {
                                      selectProduct(rowIndex, currentSuggestions[activeIdx]);
                                    } else if (invoiceType === 'PURCHASE') {
                                      triggerQuickAdd(rowIndex, row.typedName);
                                    }
                                  } else {
                                    e.preventDefault();
                                    focusCell(rowIndex, 'qty');
                                  }
                                } else if (e.key === 'Delete' && row.typedName === '') {
                                  e.preventDefault();
                                  removeRow(rowIndex);
                                }
                              }}
                              className="w-full bg-transparent border-0 outline-none text-sm text-neutral-200 placeholder-neutral-700"
                            />
                          </div>
                          {row.product && (
                            <div className="space-y-1.5 mt-1 select-none text-[10px] text-neutral-500 font-mono">
                              <div className="flex gap-3">
                                <span>
                                  {language === 'en' ? 'Stock:' : 'স্টক:'} {currentStock} pcs
                                </span>
                                {!row.product.variants || row.product.variants.length === 0 ? (
                                  row.product.priceHistory && row.product.priceHistory.length > 0 ? (
                                    <span className="text-amber-500">
                                      {language === 'en' ? 'Last Cost:' : 'শেষ ক্রয় মূল্য:'} ৳{row.product.priceHistory[0].price.toFixed(2)}
                                    </span>
                                  ) : (
                                    row.product.movingAverageCost > 0 && (
                                      <span className="text-neutral-600">
                                        {language === 'en' ? 'Avg Cost:' : 'গড় মূল্য:'} ৳{row.product.movingAverageCost.toFixed(2)}
                                      </span>
                                    )
                                  )
                                ) : (
                                  selectedVar && selectedVar.movingAverageCost > 0 && (
                                    <span className="text-neutral-600">
                                      {language === 'en' ? 'Avg Cost:' : 'গড় মূল্য:'} ৳{selectedVar.movingAverageCost.toFixed(2)}
                                    </span>
                                  )
                                )}
                              </div>

                              {row.product.variants && row.product.variants.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-semibold text-neutral-450 uppercase">
                                    {language === 'en' ? 'Variation:' : 'ভেরিয়েশন:'}
                                  </span>
                                  <select
                                    value={row.selectedVariantId || ''}
                                    onChange={(e) => {
                                      const vId = Number(e.target.value);
                                      const v = row.product?.variants?.find(x => x.id === vId);
                                      if (v) {
                                        const price = invoiceType === 'SALES' ? v.movingAverageCost * 1.25 : v.movingAverageCost;
                                        setRows(prev => prev.map((r, idx) => idx === rowIndex ? {
                                          ...r,
                                          selectedVariantId: vId,
                                          unitPrice: parseFloat(price.toFixed(2))
                                        } : r));
                                      }
                                    }}
                                    className="bg-neutral-900 border border-neutral-800 rounded px-1.5 py-0.5 text-[9px] text-neutral-300 outline-none focus:border-amber-500 font-bold cursor-pointer"
                                  >
                                    {row.product.variants.map(v => (
                                      <option key={v.id} value={v.id}>
                                        {v.name} (Stock: {v.currentStock} pcs)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          {row.showSuggestions && (row.suggestions.length > 0 || invoiceType === 'PURCHASE') && (
                            <div className="absolute left-3 right-3 top-12 z-50 max-h-56 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl p-1">
                              {row.suggestions.map((s, sIdx) => (
                                <div
                                  key={s.id}
                                  onClick={() => selectProduct(rowIndex, s)}
                                  className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-xs transition-colors ${
                                    sIdx === row.activeSuggestionIndex
                                      ? 'bg-neutral-800 text-amber-400'
                                      : 'text-neutral-300 hover:bg-neutral-800/40 hover:text-neutral-100'
                                  }`}
                                >
                                  <div>
                                    <div className="font-semibold">{s.name}</div>
                                    <div className="text-[10px] text-neutral-500">{s.category}</div>
                                  </div>
                                  <div className="text-[10px] font-mono text-neutral-400 border border-neutral-800/80 rounded px-1.5">
                                    Stock: {s.currentStock}
                                  </div>
                                </div>
                              ))}

                              {invoiceType === 'PURCHASE' && (
                                <div
                                  onClick={() => triggerQuickAdd(rowIndex, row.typedName)}
                                  className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer text-xs transition-colors border-t border-neutral-800/50 mt-1 font-semibold ${
                                    row.activeSuggestionIndex === row.suggestions.length
                                      ? 'bg-neutral-800 text-emerald-400'
                                      : 'text-emerald-500 hover:bg-neutral-800/40'
                                  }`}
                                >
                                  <Plus className="h-3.5 w-3.5 shrink-0" />
                                  {language === 'en' ? `+ Add "${row.typedName}" as New Product` : `+ নতুন পণ্য হিসেবে "${row.typedName}" যোগ`}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-3 text-center">
                          <input
                            id={`cell-${rowIndex}-${'qty'}`}
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, quantity: val } : r));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                focusCell(rowIndex, 'price');
                              }
                            }}
                            className="w-16 bg-transparent border-0 outline-none text-center text-sm font-mono text-neutral-200"
                          />
                        </td>

                        <td className="p-3 text-right">
                          <input
                            id={`cell-${rowIndex}-${'price'}`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.unitPrice || ''}
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, unitPrice: val } : r));
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                if (row.product === null) {
                                  toast(language === 'en' ? 'Please select a valid product' : 'দয়া করে একটি সঠিক পণ্য নির্বাচন করুন', 'warning');
                                  return;
                                }
                                e.preventDefault();
                                if (rowIndex === rows.length - 1) {
                                  appendBlankRow();
                                } else {
                                  focusCell(rowIndex + 1, 'product');
                                }
                              }
                            }}
                            className="w-28 bg-transparent border-0 outline-none text-right text-sm font-mono text-neutral-200 pr-1"
                          />
                        </td>

                        <td className="p-3 text-right font-mono text-sm text-neutral-400 select-none">
                          ৳{lineTotal.toFixed(2)}
                        </td>

                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeRow(rowIndex)}
                            tabIndex={-1}
                            className="text-neutral-600 hover:text-rose-500 rounded p-1 hover:bg-rose-950/20 transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-3 bg-neutral-950/20 flex justify-start">
                <button
                  onClick={appendBlankRow}
                  className="flex items-center gap-1 text-xs font-semibold text-neutral-400 hover:text-amber-400 transition-colors px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {language === 'en' ? 'Add Row (Enter/Tab)' : 'নতুন সারি যোগ (Enter/Tab)'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Summary */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm p-6 space-y-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
          <h2 className="text-base font-bold uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-3">
            {language === 'en' ? 'Summary' : 'সারসংক্ষেপ'}
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-400">{t('totalAmount')}</span>
              <span className="text-lg font-bold font-mono text-neutral-100">৳{totalAmount.toFixed(2)}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {t('paidAmount')}
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={`৳${totalAmount.toFixed(2)}`}
                value={paidAmount}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                  setPaidAmount(val);
                }}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
              />
              <span className="text-[10px] text-neutral-500">
                {language === 'en' ? 'Blank defaults to total amount' : 'ফাঁকা রাখলে মোট টাকা হিসেবে গণ্য হবে'}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
              <span className="text-sm font-medium text-neutral-400">{t('dueAmount')}</span>
              <span className={`text-lg font-bold font-mono ${calculatedDueAmount > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
                ৳{calculatedDueAmount.toFixed(2)}
              </span>
            </div>

            {calculatedDueAmount > 0 && (
              <div className="space-y-1.5 border-t border-neutral-800/60 pt-4 animate-fade-in">
                <label className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                  {language === 'en' ? 'Expected Collection Date' : 'বাকি পরিশোধের সম্ভাব্য তারিখ'}
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

          <button
            onClick={handleSaveInvoice}
            disabled={isSubmitting}
            className={`w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold tracking-wider transition-all duration-300 ${
              isSubmitting
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : invoiceType === 'SALES'
                ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-950/20'
                : 'bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-950/20'
            }`}
          >
            <Save className="h-4.5 w-4.5" />
            {isSubmitting ? t('loading') : t('submit')}
          </button>
        </div>
      </div>

      {/* QUICK ADD MODAL */}
      {quickAdd.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-neutral-100 shadow-2xl">
            <h2 className="text-base font-bold uppercase tracking-wider text-amber-400 border-b border-neutral-800 pb-3 flex items-center gap-1.5">
              <Plus className="h-5 w-5" />
              {t('quickAddProduct')}
            </h2>
            <form onSubmit={handleQuickAddSubmit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                  {t('productName')}
                </label>
                <input
                  type="text"
                  required
                  value={quickAdd.name}
                  onChange={(e) => setQuickAdd(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                  {t('category')}
                </label>
                <input
                  type="text"
                  required
                  value={quickAdd.category}
                  onChange={(e) => setQuickAdd(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Lighting, Cables, Switches etc."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 placeholder-neutral-700 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                    {t('minStock')}
                  </label>
                  <input
                    type="number"
                    value={quickAdd.minStock}
                    onChange={(e) => setQuickAdd(prev => ({ ...prev, minStock: parseInt(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                    {language === 'en' ? 'Estimated Unit Cost' : 'আনুমানিক ক্রয় মূল্য'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={quickAdd.unitCost || ''}
                    placeholder="0.00"
                    onChange={(e) => setQuickAdd(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setQuickAdd({ isOpen: false, rowIndex: -1, name: '', category: '', minStock: 5, unitCost: 0 })}
                  className="flex-1 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs font-semibold hover:bg-neutral-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-400 p-3 text-xs font-semibold text-black transition-colors"
                >
                  {t('addProduct')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
