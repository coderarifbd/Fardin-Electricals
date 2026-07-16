'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  getProductByIdAction,
  saveOnlineOrderAction,
  getCurrentCustomerAction,
  logoutCustomerAction
} from '@/lib/actions';
import { 
  ShoppingBag, 
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
  ArrowLeft,
  ShieldCheck,
  Truck,
  Sparkles,
  ChevronRight,
  LogOut,
  Check
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

// Unit helpers
function isDecimalUnit(unit?: string) {
  return unit === 'গজ' || unit === 'ফুট' || unit === 'মিটার' || unit === 'কেজি';
}
function unitStep(unit?: string) { return isDecimalUnit(unit) ? 0.5 : 1; }
function unitMin(unit?: string) { return isDecimalUnit(unit) ? 0.5 : 1; }

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

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = Number(params.id);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Cart States
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Variant selector states
  const [chosenVariantId, setChosenVariantId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [parsedAttrs, setParsedAttrs] = useState<{
    attributeKeys: string[];
    attributeValues: Record<string, string[]>;
    variantMap: Record<string, number>;
  } | null>(null);

  // Customer Authentication States
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  
  // Checkout Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);

  // Load product data & session
  useEffect(() => {
    async function loadData() {
      if (isNaN(productId)) {
        setLoading(false);
        return;
      }
      try {
        const prod = await getProductByIdAction(productId);
        if (prod) {
          setProduct(prod as any);
        }

        // Load customer
        const activeCustomer = await getCurrentCustomerAction();
        if (activeCustomer) {
          setCustomer(activeCustomer);
          setCustomerName(activeCustomer.name);
          setCustomerPhone(activeCustomer.phone);
          setCustomerAddress(activeCustomer.address || '');
        }

        // Load cart
        const cachedCart = localStorage.getItem('eshop_catalog_cart');
        if (cachedCart) {
          setCart(JSON.parse(cachedCart));
        }
      } catch (err) {
        console.error('Error loading product details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [productId]);

  // Sync cart to localStorage
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('eshop_catalog_cart', JSON.stringify(cart));
    } else {
      localStorage.removeItem('eshop_catalog_cart');
    }
  }, [cart]);

  // Parse product attributes
  useEffect(() => {
    if (product) {
      const parsed = parseProductAttributes(product);
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
  }, [product]);

  // Match selected attributes to variant ID
  useEffect(() => {
    if (parsedAttrs && product) {
      const keyValPairs = parsedAttrs.attributeKeys
        .map(k => `${k}:${selectedAttributes[k] || ''}`)
        .join('|');
      const matchedId = parsedAttrs.variantMap[keyValPairs];
      setChosenVariantId(matchedId || null);
    }
  }, [selectedAttributes, parsedAttrs]);

  const addToCart = (prod: Product, variantId: number | null, qty: number) => {
    const variant = variantId ? prod.variants?.find(v => v.id === variantId) : null;
    const baseCost = variant ? variant.movingAverageCost : prod.movingAverageCost;
    const savedRetail = variant ? (variant.retailPrice || 0) : (prod.retailPrice || 0);
    const unitPrice = savedRetail > 0 ? savedRetail : parseFloat((baseCost * 1.25).toFixed(2)); // 25% markup fallback
    const variantName = variant ? variant.name : undefined;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.product.id === prod.id && 
        item.selectedVariantId === (variantId || null)
      );

      if (existingIdx !== -1) {
        return prev.map((item, idx) => 
          idx === existingIdx ? { ...item, quantity: item.quantity + qty } : item
        );
      } else {
        return [...prev, { product: prod, selectedVariantId: variantId || null, variantName, quantity: qty, unitPrice }];
      }
    });
  };

  const handleAddToCartClick = () => {
    if (!product) return;
    addToCart(product, chosenVariantId, quantity);
    setIsCartOpen(true);
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

  const handleLogout = async () => {
    await logoutCustomerAction();
    setCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
        <span>পণ্যের বিবরণ লোড হচ্ছে...</span>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex flex-col items-center justify-center gap-4 text-xs">
        <span>Product not found or has been removed.</span>
        <Link href="/" className="px-4 py-2 bg-amber-500 text-black font-bold rounded-xl flex items-center gap-1.5 hover:bg-amber-400 transition-colors">
          <ArrowLeft className="h-4 w-4" /> ক্যাটালগে ফিরে যান
        </Link>
      </div>
    );
  }

  const hasVariants = product.variants && product.variants.length > 0;
  const activeVariant = chosenVariantId ? product.variants?.find(v => v.id === chosenVariantId) : null;
  const currentCost = activeVariant ? activeVariant.movingAverageCost : product.movingAverageCost;
  const savedRetailPrice = activeVariant ? (activeVariant.retailPrice || 0) : (product.retailPrice || 0);
  const retailPrice = savedRetailPrice > 0 ? savedRetailPrice : parseFloat((currentCost * 1.25).toFixed(2));
  
  const inStock = hasVariants
    ? (activeVariant ? activeVariant.currentStock > 0 : false)
    : product.currentStock > 0;

  const stockQty = hasVariants
    ? (activeVariant ? activeVariant.currentStock : 0)
    : product.currentStock;

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900 py-4 px-6 max-w-7xl mx-auto w-full flex justify-between items-center select-none">
        
        {/* Back Link */}
        <Link 
          href="/"
          className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-amber-550 transition-colors font-bold"
        >
          <ArrowLeft className="h-4 w-4" />
          ক্যাটালগে ফিরে যান
        </Link>

        {/* Auth / Cart Controllers */}
        <div className="flex items-center gap-3">
          {customer && (
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
          )}

          {/* Floating Cart Switch */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 p-2.5 rounded-xl transition-all cursor-pointer"
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
              onClick={() => setSuccessOrderNo(null)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-colors cursor-pointer select-none"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* DETAILED CONTENT SECTION */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* LEFT COLUMN: IMAGE & DESCRIPTION */}
          <div className="space-y-6">
            
            {/* Product Big Image */}
            <div className="relative aspect-video rounded-3xl bg-neutral-900 flex items-center justify-center text-neutral-800 border border-neutral-855 overflow-hidden shadow-xl">
              {product.imageUrl ? (
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="object-cover w-full h-full"
                />
              ) : (
                <ShoppingBag className="h-20 w-20 text-neutral-800" />
              )}
              
              <div className="absolute top-4 left-4">
                <span className="text-[10px] bg-neutral-950/80 backdrop-blur-md border border-neutral-850 text-amber-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider font-mono">
                  {product.category}
                </span>
              </div>
            </div>

            {/* Description details */}
            <div className="rounded-3xl border border-neutral-850 bg-neutral-900/10 p-6 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-350 border-b border-neutral-850 pb-2 flex items-center gap-1.5">
                <Sparkles className="h-4.5 w-4.5 text-amber-550" />
                পণ্য বিবরণী (Product Description)
              </h3>
              
              {product.description ? (
                <p className="text-xs text-neutral-400 leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              ) : (
                <p className="text-xs text-neutral-500 italic">
                  এই প্রোডাক্টের জন্য কোনো বিবরণ এখনো যোগ করা হয়নি।
                </p>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: BUY BOX & OPTIONS */}
          <div className="space-y-6 lg:sticky lg:top-24">
            
            {/* Title & Info */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-555">Genuine electrical parts</span>
              <h2 className="text-2xl md:text-3.5xl font-black text-neutral-100 tracking-tight leading-tight">
                {product.name}
              </h2>
              
              <div className="flex items-center gap-4 text-xs font-semibold select-none pt-1">
                <span className={`uppercase tracking-wider font-mono px-2.5 py-0.5 rounded-md ${chosenVariantId && inStock ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : !hasVariants && product.currentStock > 0 ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'}`}>
                  {hasVariants ? (chosenVariantId && inStock ? 'In Stock (স্টকে আছে)' : 'Out of Stock') : (product.currentStock > 0 ? 'In Stock (স্টকে আছে)' : 'Out of Stock')}
                </span>
                
                {inStock && (
                  <span className="text-neutral-500 font-mono">
                    পরিমাণ উপলব্ধ: {stockQty} টি
                  </span>
                )}
              </div>
            </div>

            {/* Price Box */}
            <div className="bg-neutral-900/40 border border-neutral-855 p-5 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-neutral-550 font-bold block uppercase tracking-wider">Retail MRP</span>
                <span className="text-2xl font-black font-mono text-neutral-100">
                  {chosenVariantId ? `৳${retailPrice.toFixed(2)}` : !hasVariants ? `৳${retailPrice.toFixed(2)}` : 'N/A'}
                </span>
              </div>
              <div className="text-right text-[10px] text-neutral-500 leading-relaxed font-semibold">
                <li>VAT/Tax হিসাব ছাড়া</li>
                <li>১০০% ক্যাশ অন ডেলিভারি</li>
              </div>
            </div>

            {/* DYNAMIC MULTIPLE ATTRIBUTE SELECTORS */}
            {hasVariants && parsedAttrs && (
              <div className="space-y-4 pt-1 select-none border border-neutral-850 p-5 rounded-2xl bg-neutral-950/40">
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
                              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
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
            )}

            {/* Quantity and Cart CTAs */}
            <div className="space-y-3 pt-4 border-t border-neutral-900">
              {/* Unit badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-450 font-bold">বিক্রয় একক:</span>
                <span className="text-xs font-black font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full">
                  {product.unit || 'পিছ'}
                </span>
                {isDecimalUnit(product.unit) && (
                  <span className="text-[10px] text-neutral-500">দশমিক পরিমাণ সম্ভব (যেমন ৫.৫)</span>
                )}
              </div>

              <div className="flex items-center gap-4">
                {isDecimalUnit(product.unit) ? (
                  /* Decimal unit — numeric input */
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={quantity <= unitMin(product.unit)}
                      onClick={() => setQuantity(prev => Math.max(unitMin(product.unit), parseFloat((prev - unitStep(product.unit)).toFixed(2))))}
                      className="h-12 w-12 flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/60 text-neutral-450 hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={unitMin(product.unit)}
                      step={unitStep(product.unit)}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(unitMin(product.unit), parseFloat(e.target.value) || unitMin(product.unit)))}
                      className="w-24 h-12 text-center font-bold font-mono text-neutral-200 text-sm rounded-xl border border-neutral-800 bg-neutral-950/60 px-2 outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={() => setQuantity(prev => parseFloat((prev + unitStep(product.unit)).toFixed(2)))}
                      className="h-12 w-12 flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-950/60 text-neutral-450 hover:text-neutral-200 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  /* Whole-number unit — standard stepper */
                  <div className="flex items-center border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60 h-12 shrink-0">
                    <button
                      disabled={quantity <= 1}
                      onClick={() => setQuantity(prev => prev - 1)}
                      className="p-3 text-neutral-450 hover:text-neutral-200 disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-5 font-bold font-mono text-neutral-200 text-sm">{quantity}</span>
                    <button
                      onClick={() => setQuantity(prev => prev + 1)}
                      className="p-3 text-neutral-450 hover:text-neutral-200 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  onClick={handleAddToCartClick}
                  disabled={hasVariants ? (chosenVariantId === null || !inStock) : !inStock}
                  className="flex-1 h-12 bg-amber-500 hover:bg-amber-450 disabled:bg-neutral-855 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 select-none text-sm"
                >
                  <ShoppingCart className="h-5 w-5" />
                  {quantity} {product.unit || 'পিছ'} কার্টে যোগ করুন
                </button>
              </div>
            </div>


            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-neutral-900 select-none">
              <div className="flex items-start gap-3 text-xs text-neutral-400">
                <Truck className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <span className="font-bold text-neutral-300 block">ক্যাশ অন ডেলিভারি</span>
                  <span className="text-[10px] text-neutral-500">সমগ্র বাংলাদেশে COD শিপিং</span>
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs text-neutral-400">
                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <span className="font-bold text-neutral-300 block">সরাসরি গ্যারান্টি</span>
                  <span className="text-[10px] text-neutral-500">আসল প্রোডাক্টের নিশ্চয়তা</span>
                </div>
              </div>
            </div>

          </div>
        </div>
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
                <div className="text-center py-20 text-xs text-neutral-555">
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
                      <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-550 block mb-2">শিপিং ও ডেলিভারি তথ্য</span>
                  
                  {!customer && (
                    <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-450 leading-relaxed flex justify-between items-center mb-3">
                      <span>অর্ডার ট্র্যাকিং ও হিস্ট্রি দেখতে চান?</span>
                      <button
                        type="button"
                        onClick={() => { setIsCartOpen(false); router.push('/'); }} 
                        className="text-[10px] font-bold bg-amber-500 text-black px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-amber-400 transition-colors"
                      >
                        লগইন করুন
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                      <User className="h-3.5 w-3.5 text-neutral-500" />
                      আপনার নাম *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: আরিকুল ইসলাম"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-955 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                      <Phone className="h-3.5 w-3.5 text-neutral-555" />
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
                  
                  <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-955/40 text-[10px] text-neutral-400 space-y-1 leading-relaxed">
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
                    className="w-full bg-amber-500 hover:bg-amber-450 text-black font-black py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
