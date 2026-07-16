'use client';

import React, { useState, useEffect } from 'react';
import { 
  getProductsAction, 
  saveOnlineOrderAction,
  registerCustomerAction,
  loginCustomerAction,
  logoutCustomerAction,
  getCurrentCustomerAction,
  getCustomerOrdersAction
} from '@/lib/actions';
import { 
  ShoppingBag, 
  Search, 
  ChevronRight, 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  CheckCircle, 
  Phone, 
  MapPin, 
  User, 
  Loader2,
  Tag,
  LogIn,
  LogOut,
  UserPlus,
  FileText,
  Clock,
  Check,
  XCircle,
  Lock,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Truck,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  retailPrice?: number;
  barcode: string | null;
  imageUrl?: string | null;
  description?: string | null;
  unit?: string;
  hasVariants?: boolean;
  variants?: {
    id: number;
    productId: number;
    name: string;
    currentStock: number;
    minStockAlert: number;
    movingAverageCost: number;
    retailPrice?: number;
    barcode?: string | null;
    attributes?: Record<string, string> | null;
  }[];
}

// Whether a unit allows decimal quantities (গজ, ফুট, মিটার, কেজি)
function isDecimalUnit(unit?: string) {
  return unit === 'গজ' || unit === 'ফুট' || unit === 'মিটার' || unit === 'কেজি';
}

function unitStep(unit?: string) {
  return isDecimalUnit(unit) ? 0.5 : 1;
}

function unitMin(unit?: string) {
  return isDecimalUnit(unit) ? 0.5 : 1;
}

interface CartItem {
  product: Product;
  selectedVariantId?: number | null;
  variantName?: string;
  quantity: number;
  unitPrice: number;
}

interface CustomerSession {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
}

interface OrderHistoryItem {
  id: number;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  orderDate: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  totalAmount: number;
  items: any[];
}

// Helper function to parse product attributes
function parseProductAttributes(product: Product) {
  if (!product.variants || product.variants.length === 0) {
    return { attributeKeys: [], attributeValues: {}, variantMap: {} };
  }

  const hasJsonAttributes = product.variants.some(v => v.attributes && Object.keys(v.attributes).length > 0);

  let attributeKeys: string[] = [];
  let attributeValues: Record<string, string[]> = {};
  const variantMap: Record<string, number> = {};

  if (hasJsonAttributes) {
    const keysSet = new Set<string>();
    product.variants.forEach(v => {
      if (v.attributes) {
        Object.keys(v.attributes).forEach(k => keysSet.add(k));
      }
    });
    attributeKeys = Array.from(keysSet);

    attributeKeys.forEach(key => {
      const valSet = new Set<string>();
      product.variants!.forEach(v => {
        if (v.attributes && v.attributes[key]) {
          valSet.add(v.attributes[key]);
        }
      });
      attributeValues[key] = Array.from(valSet);
    });

    product.variants.forEach(v => {
      if (v.attributes) {
        const keyValPairs = attributeKeys.map(k => `${k}:${v.attributes![k] || ''}`).join('|');
        variantMap[keyValPairs] = v.id;
      }
    });
  } else {
    // Parse flat name parts by splitting with hyphen or slash
    let maxParts = 1;
    const splitVariants = product.variants.map(v => {
      let parts = v.name.split(/\s*-\s*/);
      if (parts.length === 1) {
        parts = v.name.split(/\s*\/\s*/);
      }
      maxParts = Math.max(maxParts, parts.length);
      return { variantId: v.id, parts };
    });

    if (maxParts > 1) {
      attributeKeys = [];
      for (let i = 0; i < maxParts; i++) {
        attributeKeys.push(i === 0 ? 'Specification' : i === 1 ? 'Option' : `Attr-${i + 1}`);
      }

      attributeKeys.forEach((key, idx) => {
        const valSet = new Set<string>();
        splitVariants.forEach(sv => {
          if (sv.parts[idx]) {
            valSet.add(sv.parts[idx].trim());
          }
        });
        attributeValues[key] = Array.from(valSet);
      });

      splitVariants.forEach(sv => {
        const keyValPairs = attributeKeys.map((k, idx) => `${k}:${sv.parts[idx]?.trim() || ''}`).join('|');
        variantMap[keyValPairs] = sv.variantId;
      });
    } else {
      attributeKeys = ['Option'];
      attributeValues = { 'Option': product.variants.map(v => v.name) };
      product.variants.forEach(v => {
        variantMap[`Option:${v.name}`] = v.id;
      });
    }
  }

  return { attributeKeys, attributeValues, variantMap };
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Cart States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Customer Authentication States
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  
  // Auth Form Input
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authPin, setAuthPin] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Order History States
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Checkout Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);

  // Variant Selection Modal States
  const [selectedProductForVariants, setSelectedProductForVariants] = useState<Product | null>(null);
  const [chosenVariantId, setChosenVariantId] = useState<number | null>(null);
  const [variantQuantity, setVariantQuantity] = useState<number>(1);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [parsedAttrs, setParsedAttrs] = useState<{
    attributeKeys: string[];
    attributeValues: Record<string, string[]>;
    variantMap: Record<string, number>;
  } | null>(null);

  // Load products, current customer, and cached cart
  useEffect(() => {
    async function initCatalog() {
      try {
        const prodData = await getProductsAction();
        setProducts(prodData as any);
        const cats = Array.from(new Set(prodData.map(p => p.category)));
        setCategories(cats);

        // Load customer session
        const activeCustomer = await getCurrentCustomerAction();
        if (activeCustomer) {
          setCustomer(activeCustomer);
          setCustomerName(activeCustomer.name);
          setCustomerPhone(activeCustomer.phone);
          setCustomerAddress(activeCustomer.address || '');
        }

        // Load cart from localStorage
        const cachedCart = localStorage.getItem('eshop_catalog_cart');
        if (cachedCart) {
          setCart(JSON.parse(cachedCart));
        }
      } catch (err) {
        console.error('Failed to initialize catalog:', err);
      } finally {
        setLoading(false);
      }
    }
    initCatalog();
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('eshop_catalog_cart', JSON.stringify(cart));
    } else {
      localStorage.removeItem('eshop_catalog_cart');
    }
  }, [cart]);

  // Handle product variant parsing
  useEffect(() => {
    if (selectedProductForVariants) {
      const parsed = parseProductAttributes(selectedProductForVariants);
      setParsedAttrs(parsed);

      // Pre-select first values
      const initial: Record<string, string> = {};
      parsed.attributeKeys.forEach(k => {
        if (parsed.attributeValues[k] && parsed.attributeValues[k].length > 0) {
          initial[k] = parsed.attributeValues[k][0];
        }
      });
      setSelectedAttributes(initial);
    } else {
      setParsedAttrs(null);
      setSelectedAttributes({});
      setChosenVariantId(null);
    }
  }, [selectedProductForVariants]);

  // Match selected attributes to variant ID
  useEffect(() => {
    if (parsedAttrs && selectedProductForVariants) {
      const keyValPairs = parsedAttrs.attributeKeys
        .map(k => `${k}:${selectedAttributes[k] || ''}`)
        .join('|');
      const matchedId = parsedAttrs.variantMap[keyValPairs];
      setChosenVariantId(matchedId || null);
    }
  }, [selectedAttributes, parsedAttrs]);

  const loadOrderHistory = async () => {
    if (!customer) return;
    setLoadingHistory(true);
    try {
      const data = await getCustomerOrdersAction();
      setOrderHistory(data as OrderHistoryItem[]);
    } catch (err) {
      console.error('Failed to load order history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (customer && showOrdersModal) {
      loadOrderHistory();
    }
  }, [customer, showOrdersModal]);

  const addToCart = (product: Product, variantId?: number | null, quantityMultiplier: number = 1) => {
    const variant = variantId ? product.variants?.find(v => v.id === variantId) : null;
    const baseCost = variant ? variant.movingAverageCost : product.movingAverageCost;
    const savedRetail = variant ? (variant.retailPrice || 0) : (product.retailPrice || 0);
    const unitPrice = savedRetail > 0 ? savedRetail : parseFloat((baseCost * 1.25).toFixed(2)); // 25% markup fallback
    const variantName = variant ? variant.name : undefined;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.product.id === product.id && 
        item.selectedVariantId === (variantId || null)
      );

      if (existingIdx !== -1) {
        return prev.map((item, idx) => 
          idx === existingIdx ? { ...item, quantity: item.quantity + quantityMultiplier } : item
        );
      } else {
        return [...prev, { product, selectedVariantId: variantId || null, variantName, quantity: quantityMultiplier, unitPrice }];
      }
    });
  };

  const handleOpenVariantModal = (product: Product) => {
    setSelectedProductForVariants(product);
    setVariantQuantity(1);
  };

  const handleAddVariantToCart = () => {
    if (!selectedProductForVariants) return;
    addToCart(selectedProductForVariants, chosenVariantId, variantQuantity);
    setSelectedProductForVariants(null);
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => prev.map((item, idx) => {
      if (idx === index) {
        const nextQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: nextQty };
      }
      return item;
    }));
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, idx) => idx !== index));
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (authMode === 'LOGIN') {
        const res = await loginCustomerAction(authPhone, authPin);
        if (res.success && res.customer) {
          setCustomer(res.customer);
          setCustomerName(res.customer.name);
          setCustomerPhone(res.customer.phone);
          setCustomerAddress(res.customer.address || '');
          setShowAuthModal(false);
        }
      } else {
        const res = await registerCustomerAction(authName, authPhone, authAddress, authPin);
        if (res.success && res.customer) {
          setCustomer(res.customer);
          setCustomerName(res.customer.name);
          setCustomerPhone(res.customer.phone);
          setCustomerAddress(res.customer.address || '');
          setShowAuthModal(false);
        }
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logoutCustomerAction();
    setCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderHistory([]);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || orderSubmitting) return;

    setOrderSubmitting(true);
    try {
      const itemsPayload = cart.map(item => ({
        productId: item.product.id,
        variantId: item.selectedVariantId || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        name: `${item.product.name}${item.variantName ? ` (${item.variantName})` : ''}`
      }));

      const res = await saveOnlineOrderAction({
        customerName,
        customerPhone,
        customerAddress,
        items: itemsPayload,
        customerId: customer?.id || null
      });

      if (res.success && res.order) {
        setSuccessOrderNo(res.order.orderNo);
        setCart([]);
        localStorage.removeItem('eshop_catalog_cart');
        setIsCheckingOut(false);
        setIsCartOpen(false);
      } else {
        alert(res.error || 'Failed to place order');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'An error occurred while submitting order.');
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Find currently active matched variant object to check stock
  const activeVariantObject = selectedProductForVariants && chosenVariantId
    ? selectedProductForVariants.variants?.find(v => v.id === chosenVariantId)
    : null;
  const isSelectedVariantInStock = activeVariantObject ? activeVariantObject.currentStock > 0 : false;
  const matchedPrice = activeVariantObject
    ? (activeVariantObject.retailPrice && activeVariantObject.retailPrice > 0
        ? activeVariantObject.retailPrice
        : parseFloat((activeVariantObject.movingAverageCost * 1.25).toFixed(2)))
    : selectedProductForVariants
      ? (selectedProductForVariants.retailPrice && selectedProductForVariants.retailPrice > 0
          ? selectedProductForVariants.retailPrice
          : parseFloat((selectedProductForVariants.movingAverageCost * 1.25).toFixed(2)))
      : 0;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900 py-4 px-6 max-w-7xl mx-auto w-full flex flex-col sm:flex-row justify-between items-center gap-4">
        
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 p-2 rounded-xl text-black">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-neutral-100">Fardin Electricals</h1>
            <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold font-mono">Online Store</p>
          </div>
        </div>

        {/* Auth / Cart Controllers */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end select-none">
          
          {customer ? (
            <div className="flex items-center gap-2">
              {/* My Orders Button */}
              <button
                onClick={() => setShowOrdersModal(true)}
                className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 px-3.5 py-2.5 rounded-xl text-xs font-bold text-neutral-250 cursor-pointer transition-colors"
              >
                <FileText className="h-4 w-4 text-amber-500" />
                আমার অর্ডার ({orderHistory.length})
              </button>

              {/* Logged in Profile & Logout */}
              <div className="flex items-center gap-1.5 bg-neutral-900/60 border border-neutral-850 px-3.5 py-2 rounded-xl text-xs">
                <span className="font-semibold text-neutral-300 max-w-28 truncate">{customer.name}</span>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="text-neutral-500 hover:text-rose-500 transition-colors cursor-pointer ml-1"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setAuthMode('LOGIN'); setShowAuthModal(true); }}
              className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-200 transition-colors cursor-pointer"
            >
              <LogIn className="h-4 w-4 text-amber-555" />
              লগইন / রেজিস্ট্রেশন
            </button>
          )}

          {/* Floating Cart Switch */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 bg-neutral-900 border border-neutral-805 hover:border-amber-500/50 p-2.5 rounded-xl transition-all cursor-pointer"
          >
            <ShoppingCart className="h-5 w-5 text-neutral-300" />
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center animate-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* SUCCESS ORDER BANNER */}
      {successOrderNo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl max-w-md w-full text-center space-y-5 animate-scale-up shadow-2xl">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto animate-pulse" />
            <h2 className="text-xl font-bold text-neutral-100">Order Placed Successfully!</h2>
            <p className="text-xs text-neutral-400">
              Your order has been recorded. Our support staff will contact you shortly to confirm the shipment.
            </p>
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">Order Reference No</span>
              <span className="text-lg font-black font-mono text-amber-400">{successOrderNo}</span>
            </div>
            <button
              onClick={() => { setSuccessOrderNo(null); if (customer) loadOrderHistory(); }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-colors cursor-pointer select-none"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMER LOGIN/REGISTER MODAL */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl animate-scale-up relative">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg border border-neutral-800 text-neutral-455 hover:text-neutral-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-neutral-855 pb-3">
              <h3 className="text-base font-bold text-neutral-200 flex items-center gap-1.5">
                <User className="h-5 w-5 text-amber-500" />
                {authMode === 'LOGIN' ? 'কাস্টমার লগইন' : 'নতুন কাস্টমার রেজিস্ট্রেশন'}
              </h3>
              <p className="text-[10px] text-neutral-505 mt-1">
                {authMode === 'LOGIN' 
                  ? 'আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করে আগের অর্ডারের স্ট্যাটাস দেখুন।' 
                  : 'সহজে অর্ডার ট্র্যাকিং ও দ্রুত চেকআউট করার জন্য একটি অ্যাকাউন্ট খুলুন।'}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {authError && (
                <div className="p-2.5 rounded-lg border border-rose-955 bg-rose-955/20 text-rose-450 text-[11px] font-semibold">
                  {authError}
                </div>
              )}

              {authMode === 'REGISTER' && (
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400 font-semibold">আপনার নাম *</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: আরিকুল ইসলাম"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-2.5 text-xs text-neutral-200 outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-neutral-400 font-semibold">মোবাইল নম্বর *</label>
                <input
                  type="tel"
                  required
                  placeholder="যেমন: 017XXXXXXXX"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-955 p-2.5 text-xs text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {authMode === 'REGISTER' && (
                <div className="space-y-1">
                  <label className="text-xs text-neutral-400 font-semibold">ডেলিভারি ঠিকানা</label>
                  <textarea
                    rows={2}
                    placeholder="হাউজ নং, রোড নং, এলাকা, জেলা"
                    value={authAddress}
                    onChange={(e) => setAuthAddress(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-955 p-2.5 text-xs text-neutral-200 outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-neutral-400 font-semibold flex items-center justify-between">
                  <span>পাসওয়ার্ড / পিন কোড *</span>
                  <span className="text-[9px] text-neutral-500 normal-case font-normal">(অর্ডার ট্র্যাকিং সুরক্ষিত রাখার জন্য)</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="৪ থেকে ৮ ডিজিটের পাসওয়ার্ড দিন"
                  value={authPin}
                  onChange={(e) => setAuthPin(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-955 p-2.5 text-xs text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-450 disabled:bg-neutral-800 text-black font-black py-2.5 rounded-xl transition-all cursor-pointer text-xs flex justify-center items-center gap-1.5"
              >
                {authSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : authMode === 'LOGIN' ? (
                  <>
                    <LogIn className="h-4 w-4" />
                    লগইন করুন
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    রেজিস্ট্রেশন সম্পূর্ণ করুন
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2.5 border-t border-neutral-855 text-xs select-none">
              {authMode === 'LOGIN' ? (
                <span className="text-neutral-450">
                  নতুন অ্যাকাউন্ট খুলতে চান?{' '}
                  <button 
                    onClick={() => { setAuthMode('REGISTER'); setAuthError(''); }}
                    className="text-amber-500 hover:underline font-bold cursor-pointer"
                  >
                    রেজিস্ট্রেশন করুন
                  </button>
                </span>
              ) : (
                <span className="text-neutral-455">
                  ইতিমধ্যে অ্যাকাউন্ট আছে?{' '}
                  <button 
                    onClick={() => { setAuthMode('LOGIN'); setAuthError(''); }}
                    className="text-amber-500 hover:underline font-bold cursor-pointer"
                  >
                    লগইন করুন
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER MY ORDERS MODAL */}
      {showOrdersModal && customer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-2xl w-full h-[80vh] flex flex-col justify-between shadow-2xl animate-scale-up relative">
            <button 
              onClick={() => setShowOrdersModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg border border-neutral-800 text-neutral-450 hover:text-neutral-200 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-neutral-855 pb-3">
              <h3 className="text-base font-bold text-neutral-200 flex items-center gap-1.5">
                <FileText className="h-5 w-5 text-amber-500" />
                আপনার পূর্ববর্তী অনলাইন অর্ডারসমূহ (My Orders)
              </h3>
              <p className="text-[10px] text-neutral-500 mt-1">
                মোবাইল নম্বর: <span className="font-mono text-neutral-350 font-bold">{customer.phone}</span> | আপনার নাম: <span className="text-neutral-350 font-bold">{customer.name}</span>
              </p>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
              {loadingHistory ? (
                <div className="text-center py-20 text-xs text-neutral-550 flex flex-col items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                  অর্ডারের ইতিহাস লোড হচ্ছে...
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="text-center py-20 text-xs text-neutral-600">
                  এখনো কোনো অর্ডার করা হয়নি।
                </div>
              ) : (
                orderHistory.map((order) => (
                  <div key={order.id} className="p-4 rounded-xl border border-neutral-855 bg-neutral-950/40 space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-neutral-200 block text-xs">{order.orderNo}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">Date: {order.orderDate}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-neutral-200">৳{order.totalAmount.toFixed(2)}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                          order.status === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : order.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                        }`}>
                          {order.status === 'PENDING' && 'PENDING (অপেক্ষমান)'}
                          {order.status === 'APPROVED' && 'APPROVED (অনুমোদিত)'}
                          {order.status === 'CANCELLED' && 'CANCELLED (বাতিল)'}
                        </span>
                      </div>
                    </div>

                    {/* Items snippet */}
                    <div className="bg-neutral-955 p-2.5 rounded-lg border border-neutral-900 text-[11px] text-neutral-400 space-y-1">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between">
                          <span>{item.name} x {item.quantity}</span>
                          <span className="font-mono text-neutral-300">৳{(item.quantity * item.unitPrice).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-neutral-855 pt-3 text-right">
              <button
                onClick={() => setShowOrdersModal(false)}
                className="bg-neutral-800 hover:bg-neutral-750 text-neutral-300 px-5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECT DYNAMIC ATTRIBUTE VARIANT MODAL */}
      {selectedProductForVariants && parsedAttrs && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-md w-full space-y-5 shadow-2xl animate-scale-up relative">
            <button 
              onClick={() => setSelectedProductForVariants(null)}
              className="absolute right-4 top-4 p-1 rounded-lg border border-neutral-800 text-neutral-450 hover:text-neutral-250 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div>
              <span className="text-[9px] bg-amber-500/10 text-amber-450 font-bold px-2 py-0.5 rounded uppercase tracking-wider block w-max font-mono">
                {selectedProductForVariants.category}
              </span>
              <h3 className="text-base font-bold text-neutral-100 mt-2">
                {selectedProductForVariants.name}
              </h3>
              <p className="text-[10px] text-neutral-500 mt-0.5">অর্ডার করার জন্য নিচে থেকে বৈশিষ্ট্যগুলো সিলেক্ট করুন।</p>
            </div>

            {/* DYNAMIC MULTIPLE ATTRIBUTE SELECTORS */}
            <div className="space-y-4 pt-1 select-none">
              {parsedAttrs.attributeKeys.map((key) => {
                const label = key === 'Specification' 
                  ? 'সাইজ / বৈশিষ্ট্য (Specification)' 
                  : key === 'Option' 
                  ? 'কালার / বিকল্প (Color / Type)' 
                  : key;
                  
                const values = parsedAttrs.attributeValues[key] || [];

                return (
                  <div key={key} className="space-y-2">
                    <span className="text-[11px] font-bold text-neutral-450 uppercase tracking-wider block">{label}:</span>
                    <div className="flex flex-wrap gap-2">
                      {values.map((val) => {
                        const isSelected = selectedAttributes[key] === val;
                        return (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setSelectedAttributes(prev => ({ ...prev, [key]: val }))}
                            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-amber-500 text-black border-amber-500 shadow-md shadow-amber-500/10'
                                : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:border-neutral-800'
                            }`}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Price & Stock info of matched variant */}
            <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 flex justify-between items-center select-none">
              <div>
                <span className="text-[9px] text-neutral-500 uppercase tracking-wider block">Selected Option Retail MRP</span>
                <span className="text-base font-black font-mono text-neutral-200">
                  {chosenVariantId ? `৳${matchedPrice.toFixed(2)}` : 'N/A'}
                </span>
              </div>

              <div className="text-right">
                <span className={`text-[9px] uppercase font-bold tracking-wider font-mono px-2 py-0.5 rounded ${
                  chosenVariantId && isSelectedVariantInStock
                    ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                }`}>
                  {chosenVariantId && isSelectedVariantInStock ? 'In Stock' : 'Out of Stock'}
                </span>
                {chosenVariantId && isSelectedVariantInStock && (
                  <span className="block text-[9px] text-neutral-500 mt-1 font-mono">
                    Stock: {activeVariantObject?.currentStock} pcs
                  </span>
                )}
              </div>
            </div>

            {/* Quantity Selector — unit-aware */}
            <div className="flex items-center justify-between border-t border-neutral-850 pt-4">
              <div>
                <span className="text-xs text-neutral-450 font-bold block">পরিমাণ (Quantity):</span>
                {selectedProductForVariants?.unit && (
                  <span className="text-[10px] text-amber-500 font-mono font-bold">
                    একক: {selectedProductForVariants.unit}
                    {isDecimalUnit(selectedProductForVariants.unit) && ' (দশমিক সংখ্যা সম্ভব)'}
                  </span>
                )}
              </div>
              
              {isDecimalUnit(selectedProductForVariants?.unit) ? (
                /* Decimal unit: show numeric input with step */
                <div className="flex items-center gap-2">
                  <button
                    disabled={variantQuantity <= unitMin(selectedProductForVariants?.unit)}
                    onClick={() => setVariantQuantity(prev => Math.max(unitMin(selectedProductForVariants?.unit), parseFloat((prev - unitStep(selectedProductForVariants?.unit)).toFixed(2))))}
                    className="p-2 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-455 hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={unitMin(selectedProductForVariants?.unit)}
                    step={unitStep(selectedProductForVariants?.unit)}
                    value={variantQuantity}
                    onChange={e => setVariantQuantity(Math.max(unitMin(selectedProductForVariants?.unit), parseFloat(e.target.value) || unitMin(selectedProductForVariants?.unit)))}
                    className="w-20 text-center font-bold font-mono text-neutral-200 text-sm rounded-lg border border-neutral-800 bg-neutral-955 px-2 py-1.5 outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={() => setVariantQuantity(prev => parseFloat((prev + unitStep(selectedProductForVariants?.unit)).toFixed(2)))}
                    className="p-2 rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-455 hover:text-neutral-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                /* Whole-number unit: standard stepper */
                <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950">
                  <button
                    disabled={variantQuantity <= 1}
                    onClick={() => setVariantQuantity(prev => prev - 1)}
                    className="p-2 text-neutral-455 hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="px-4 font-bold font-mono text-neutral-200 text-sm">{variantQuantity}</span>
                  <button
                    onClick={() => setVariantQuantity(prev => prev + 1)}
                    className="p-2 text-neutral-455 hover:text-neutral-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* CTA button */}
            <button
              onClick={handleAddVariantToCart}
              disabled={chosenVariantId === null || !isSelectedVariantInStock}
              className="w-full bg-amber-500 hover:bg-amber-450 disabled:bg-neutral-850 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-black py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs"
            >
              <ShoppingCart className="h-4 w-4" />
              {variantQuantity} {selectedProductForVariants?.unit || 'পিছ'} কার্টে যোগ করুন
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 pb-24">
        
        {/* PREMIUM REDESIGNED HERO BANNER */}
        <div className="relative rounded-3xl border border-neutral-900 bg-gradient-to-br from-neutral-900 via-neutral-955 to-neutral-900 p-8 md:p-12 overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Subtle background blur accents */}
          <div className="absolute top-0 right-1/4 h-72 w-72 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute -bottom-10 left-10 h-64 w-64 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />

          {/* Left Text Block */}
          <div className="max-w-xl space-y-6 text-left">
            <span className="inline-flex items-center gap-1.5 text-[10px] bg-amber-500/10 text-amber-400 font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-amber-500/20 font-mono">
              <Sparkles className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              Electrical Components & Retail Hub
            </span>
            <h2 className="text-3xl md:text-4.5xl font-black tracking-tight text-neutral-100 leading-tight">
              উнят মানের ইলেকট্রিক্যাল পণ্য, <br />
              <span className="bg-gradient-to-r from-amber-500 to-yellow-400 bg-clip-text text-transparent">সরাসরি আপনার ঠিকানায়।</span>
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              ফারদিন ইলেকট্রিক্যালস-এর অনলাইন শোরুমে আপনাকে স্বাগতম। তার, লাইট, সুইচবোর্ড থেকে শুরু করে যেকোনো ইলেকট্রিক্যাল পণ্য ব্রাউজ করে অর্ডার করুন ক্যাশ অন ডেলিভারিতে।
            </p>

            {/* Highlighted Store benefits list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 select-none">
              <div className="flex items-center gap-2.5 text-xs text-neutral-300">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                  <Truck className="h-4 w-4" />
                </div>
                <span>২৪-৪৮ ঘণ্টায় ফাস্ট ডেলিভারি</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-neutral-300">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <span>১০০% আসল প্রোডাক্ট গ্যারান্টি</span>
              </div>
            </div>
          </div>

          {/* Right Product Collage Illustration with generated image */}
          <div className="relative w-full md:w-5/12 aspect-[4/3] max-w-sm shrink-0 rounded-2xl overflow-hidden border border-neutral-850 shadow-2xl bg-neutral-900 group select-none">
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-955 via-transparent to-transparent opacity-80 z-10 pointer-events-none" />
            <img 
              src="/hero.png" 
              alt="Premium Electrical Appliances Show" 
              className="object-cover w-full h-full group-hover:scale-103 transition-transform duration-700"
            />
            <div className="absolute inset-0 border border-amber-500/10 group-hover:border-amber-500/35 transition-colors duration-500 rounded-2xl pointer-events-none z-20" />
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-505" />
            <input
              type="text"
              placeholder="পণ্য বা ক্যাটাগরির নাম দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-900 bg-neutral-900/50 pl-10 pr-4 py-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-all placeholder:text-neutral-505 font-medium"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1.5 scrollbar-thin select-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                  : 'bg-neutral-900 text-neutral-450 border border-neutral-850 hover:border-neutral-800'
              }`}
            >
              সব প্রোডাক্ট
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                    : 'bg-neutral-900 text-neutral-450 border border-neutral-850 hover:border-neutral-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* PRODUCT GRID */}
        {loading ? (
          <div className="text-center py-20 text-xs text-neutral-550 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            ক্যাটালগ লোড হচ্ছে...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-xs text-neutral-600">
            কোনো প্রোডাক্ট পাওয়া হয়নি।
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const baseCost = p.movingAverageCost;
              const savedProductRetail = p.retailPrice || 0;
              const retailPrice = savedProductRetail > 0 ? savedProductRetail : parseFloat((baseCost * 1.25).toFixed(2));
              
              const hasVariants = p.variants && p.variants.length > 0;
              const hasStock = hasVariants
                ? p.variants!.some(v => v.currentStock > 0)
                : p.currentStock > 0;

              // Calculate price range for variants
              let minPrice = retailPrice;
              let maxPrice = retailPrice;
              if (hasVariants && p.variants) {
                const prices = p.variants.map(v => {
                  const savedVarRetail = v.retailPrice || 0;
                  return savedVarRetail > 0 ? savedVarRetail : parseFloat((v.movingAverageCost * 1.25).toFixed(2));
                });
                minPrice = Math.min(...prices);
                maxPrice = Math.max(...prices);
              }

              return (
                <div 
                  key={p.id} 
                  className="rounded-2xl border border-neutral-900 bg-neutral-900/20 hover:bg-neutral-900/40 p-4 transition-all flex flex-col justify-between group hover:border-amber-500/20 hover:shadow-lg relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Image Link */}
                    <Link href={`/product/${p.id}`} className="block">
                      <div className="relative aspect-video rounded-xl bg-neutral-955 flex items-center justify-center text-neutral-705 overflow-hidden border border-neutral-900 select-none">
                        {p.imageUrl ? (
                          <img 
                            src={p.imageUrl} 
                            alt={p.name} 
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <ShoppingBag className="h-8 w-8 text-neutral-800 group-hover:scale-110 transition-transform duration-500" />
                        )}
                        
                        <div className="absolute top-2 left-2 flex items-center gap-1.5">
                          <span className="text-[9px] bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-neutral-350 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider font-mono">
                            {p.category}
                          </span>
                        </div>
                      </div>
                    </Link>

                    <div className="space-y-1">
                      <Link href={`/product/${p.id}`} className="block">
                        <h3 className="text-sm font-bold text-neutral-200 line-clamp-1 group-hover:text-amber-400 transition-colors">
                          {p.name}
                        </h3>
                      </Link>
                      
                      <div className="flex justify-between items-center text-[10px] text-neutral-505">
                        {hasVariants ? (
                          <span className="text-amber-500/85 font-bold flex items-center gap-1 font-mono">
                            <Tag className="h-3 w-3 text-amber-500" />
                            {p.variants?.length} Options available
                          </span>
                        ) : (
                          <span className="font-mono">
                            স্টক: {p.currentStock > 0 ? `${p.currentStock} টি` : 'স্টক শেষ'}
                          </span>
                        )}

                        <span className={`uppercase font-bold tracking-wider font-mono text-[9px] ${hasStock ? 'text-emerald-500' : 'text-rose-550'}`}>
                          {hasStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Add to Cart action */}
                  <div className="mt-4 pt-4 border-t border-neutral-900 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[9px] text-neutral-500 block uppercase font-bold tracking-wider font-mono">Retail MRP</span>
                      <span className="text-sm font-black font-mono text-neutral-100">
                        {hasVariants ? (
                          minPrice === maxPrice ? `৳${minPrice.toFixed(0)}` : `৳${minPrice.toFixed(0)} - ৳${maxPrice.toFixed(0)}`
                        ) : (
                          `৳${retailPrice.toFixed(2)}`
                        )}
                      </span>
                    </div>

                    {hasVariants ? (
                      <button
                        onClick={() => handleOpenVariantModal(p)}
                        className="bg-neutral-900 border border-neutral-800 text-neutral-250 hover:text-amber-500 hover:border-amber-500/40 font-bold text-xs py-2 px-3.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer select-none"
                      >
                        <Tag className="h-3.5 w-3.5" />
                        অপশন দেখুন
                      </button>
                    ) : (
                      <button
                        onClick={() => addToCart(p, null)}
                        disabled={p.currentStock === 0}
                        className="bg-amber-500 hover:bg-amber-450 disabled:bg-neutral-850 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-black text-xs py-2 px-4.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer select-none"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CART DRAWER PANEL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="bg-neutral-900 border-l border-neutral-800 w-full max-w-md h-full flex flex-col justify-between shadow-2xl animate-slide-left p-6">
            
            {/* Drawer Header */}
            <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-neutral-100">Shopping Cart</h3>
              </div>
              <button 
                onClick={() => { setIsCartOpen(false); setIsCheckingOut(false); }} 
                className="p-1 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-255 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-xs text-neutral-505">
                  কার্ট খালি। কেনাকাটা শুরু করুন।
                </div>
              ) : !isCheckingOut ? (
                cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-neutral-955 border border-neutral-850 text-xs gap-3">
                    <div className="space-y-1">
                      <div className="font-bold text-neutral-200">{item.product.name}</div>
                      {item.variantName && (
                        <div className="text-[10px] text-amber-550 font-semibold">{item.variantName}</div>
                      )}
                      <div className="font-mono text-neutral-500">Unit Price: ৳{item.unitPrice.toFixed(2)}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Qty controls */}
                      <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden bg-neutral-905">
                        <button 
                          onClick={() => updateCartQty(idx, -1)}
                          className="p-1 text-neutral-400 hover:text-neutral-205 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-bold font-mono text-neutral-200">{item.quantity}</span>
                        <button 
                          onClick={() => updateCartQty(idx, 1)}
                          className="p-1 text-neutral-400 hover:text-neutral-205 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="text-right w-20 font-bold font-mono text-neutral-100">
                        ৳{(item.quantity * item.unitPrice).toFixed(2)}
                      </div>

                      <button 
                        onClick={() => removeFromCart(idx)}
                        className="text-neutral-550 hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                /* CHECKOUT SUBMIT FORM */
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-505 block mb-2">শিপিং ও ডেলিভারি তথ্য</span>
                  
                  {!customer && (
                    <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-450 leading-relaxed flex justify-between items-center mb-3">
                      <span>অর্ডার ট্র্যাকিং ও হিস্ট্রি দেখতে চান?</span>
                      <button
                        type="button"
                        onClick={() => { setAuthMode('LOGIN'); setShowAuthModal(true); }}
                        className="text-[10px] font-bold bg-amber-500 text-black px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-amber-400 transition-colors"
                      >
                        লগইন করুন
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                      <User className="h-3.5 w-3.5 text-neutral-505" />
                      আপনার নাম *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: আরিকুল ইসলাম"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                      <Phone className="h-3.5 w-3.5 text-neutral-505" />
                      মোবাইল নম্বর *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="যেমন: 017XXXXXXXX"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-955 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                      <MapPin className="h-3.5 w-3.5 text-neutral-505" />
                      ডেলিভারি ঠিকানা
                    </label>
                    <textarea
                      rows={3}
                      placeholder="হাউজ নং, রোড নং, এলাকা, জেলা"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  
                  <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-950/40 text-[10px] text-neutral-400 space-y-1 leading-relaxed">
                    <span className="font-bold text-amber-550 uppercase block mb-1">শিপিং নোট</span>
                    <li>সব অর্ডারে ক্যাশ অন ডেলিভারি (COD) উপলব্ধ।</li>
                    <li>অর্ডার প্লেস করার পর ২৪ থেকে ৪৮ ঘণ্টার মধ্যে ডেলিভারি সম্পন্ন করা হবে।</li>
                  </div>

                  <button
                    type="submit"
                    disabled={orderSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-450 disabled:bg-neutral-855 text-black font-black py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {orderSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        অর্ডার সাবমিট হচ্ছে...
                      </>
                    ) : (
                      <>
                        অর্ডার সম্পন্ন করুন (৳{cartTotal.toFixed(2)})
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Cart Summary & CTA Buttons */}
            {cart.length > 0 && (
              <div className="border-t border-neutral-800 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-neutral-455 font-bold uppercase tracking-wider">Subtotal:</span>
                  <span className="text-lg font-black font-mono text-neutral-100">৳{cartTotal.toFixed(2)}</span>
                </div>

                {!isCheckingOut ? (
                  <button
                    onClick={() => setIsCheckingOut(true)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Checkout Order
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCheckingOut(false)}
                    className="w-full bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 font-bold py-3 rounded-xl transition-colors cursor-pointer"
                  >
                    Back to Cart
                  </button>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
