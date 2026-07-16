'use client';

import React, { useState, useEffect } from 'react';
import { getProductsAction, saveOnlineOrderAction } from '@/lib/actions';
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
  Tag
} from 'lucide-react';
import Image from 'next/image';

interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  barcode: string | null;
  imageUrl?: string | null;
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
  variantName?: string;
  quantity: number;
  unitPrice: number;
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

  // Checkout Form States
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);

  // Load products
  useEffect(() => {
    async function loadProducts() {
      try {
        const data = await getProductsAction();
        setProducts(data as any);
        
        // Extract unique categories
        const cats = Array.from(new Set(data.map(p => p.category)));
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load catalog products:', err);
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, []);

  const addToCart = (product: Product, variantId?: number | null) => {
    const variant = variantId ? product.variants?.find(v => v.id === variantId) : null;
    const baseCost = variant ? variant.movingAverageCost : product.movingAverageCost;
    const unitPrice = parseFloat((baseCost * 1.25).toFixed(2)); // 25% markup
    const variantName = variant ? variant.name : undefined;

    setCart(prev => {
      const existingIdx = prev.findIndex(item => 
        item.product.id === product.id && 
        item.selectedVariantId === (variantId || null)
      );

      if (existingIdx !== -1) {
        return prev.map((item, idx) => 
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, { product, selectedVariantId: variantId || null, variantName, quantity: 1, unitPrice }];
      }
    });
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
        items: itemsPayload
      });

      if (res.success && res.order) {
        setSuccessOrderNo(res.order.orderNo);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
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

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-900 py-4 px-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="bg-amber-500 p-2 rounded-xl text-black">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-neutral-100">Fardin Electricals</h1>
            <p className="text-[10px] text-amber-500 uppercase tracking-widest font-bold">Online Catalog</p>
          </div>
        </div>

        {/* Floating Cart Switch */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative flex items-center gap-2 bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 p-2.5 rounded-xl transition-all cursor-pointer select-none"
        >
          <ShoppingCart className="h-5 w-5 text-neutral-300" />
          {cartItemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center animate-bounce">
              {cartItemCount}
            </span>
          )}
        </button>
      </header>

      {/* SUCCESS BANNER MODAL */}
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

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 pb-24">
        
        {/* HERO BANNER */}
        <div className="relative rounded-3xl border border-neutral-900 bg-gradient-to-r from-amber-500/10 via-neutral-900/60 to-neutral-950 p-8 overflow-hidden shadow-lg">
          <div className="absolute right-0 top-0 h-64 w-64 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />
          <div className="max-w-xl space-y-3">
            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Electrical Components & Retail Shop
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-neutral-100">
              High Quality Electrical Products, Delivered to Your Doorstep.
            </h2>
            <p className="text-xs text-neutral-400">
              Browse our live inventory catalog below, pick components, and place your order instantly. No login required.
            </p>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              placeholder="Search products or categories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-neutral-900 bg-neutral-900/50 pl-10 pr-4 py-3 text-sm text-neutral-200 outline-none focus:border-amber-500 transition-all placeholder:text-neutral-500"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1.5 scrollbar-thin select-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-amber-500 text-black'
                  : 'bg-neutral-900 text-neutral-450 border border-neutral-850'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-black'
                    : 'bg-neutral-900 text-neutral-450 border border-neutral-850'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* PRODUCT GRID */}
        {loading ? (
          <div className="text-center py-20 text-xs text-neutral-500 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            Loading catalog...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 text-xs text-neutral-500">
            No products found matching your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p) => {
              const baseCost = p.movingAverageCost;
              const retailPrice = parseFloat((baseCost * 1.25).toFixed(2));
              const hasVariants = p.variants && p.variants.length > 0;
              const hasStock = hasVariants
                ? p.variants!.some(v => v.currentStock > 0)
                : p.currentStock > 0;

              return (
                <div 
                  key={p.id} 
                  className="rounded-2xl border border-neutral-900 bg-neutral-900/20 hover:bg-neutral-900/40 p-4 transition-all flex flex-col justify-between group hover:border-amber-500/20 hover:shadow-lg relative overflow-hidden"
                >
                  <div className="space-y-3">
                    {/* Image placeholder or real image */}
                    <div className="relative aspect-video rounded-xl bg-neutral-950 flex items-center justify-center text-neutral-705 overflow-hidden border border-neutral-900">
                      {p.imageUrl ? (
                        <img 
                          src={p.imageUrl} 
                          alt={p.name} 
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <ShoppingBag className="h-10 w-10 text-neutral-800" />
                      )}
                      
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="text-[9px] bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 text-neutral-350 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                          {p.category}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-sm font-bold text-neutral-200 line-clamp-1 group-hover:text-amber-400 transition-colors">
                        {p.name}
                      </h3>
                      
                      <div className="flex justify-between items-center">
                        {hasVariants ? (
                          <span className="text-[10px] text-amber-500/80 font-bold flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {p.variants?.length} Options available
                          </span>
                        ) : (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            Stock: {p.currentStock > 0 ? `${p.currentStock} units` : 'Out of Stock'}
                          </span>
                        )}

                        <span className={`text-[10px] uppercase font-bold tracking-wider ${hasStock ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {hasStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price & Cart CTA */}
                  <div className="mt-4 pt-4 border-t border-neutral-900 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] text-neutral-500 block uppercase font-bold tracking-wider">Retail MRP</span>
                      <span className="text-base font-black font-mono text-neutral-100">
                        {hasVariants ? (
                          `৳${retailPrice.toFixed(0)}+`
                        ) : (
                          `৳${retailPrice.toFixed(2)}`
                        )}
                      </span>
                    </div>

                    {hasVariants ? (
                      <div className="flex flex-col gap-1 w-2/3">
                        {p.variants?.map(v => (
                          <button
                            key={v.id}
                            disabled={v.currentStock === 0}
                            onClick={() => addToCart(p, v.id)}
                            className="text-[10px] font-bold py-1 px-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-500/50 hover:bg-amber-500/10 text-neutral-350 hover:text-amber-500 transition-all text-left flex justify-between items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <span>{v.name}</span>
                            <span className="font-mono">৳{(v.movingAverageCost * 1.25).toFixed(0)}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(p, null)}
                        disabled={p.currentStock === 0}
                        className="bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-850 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-black text-xs py-2 px-3 rounded-xl transition-all flex items-center gap-1 cursor-pointer select-none"
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
                className="p-1 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-250 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {cart.length === 0 ? (
                <div className="text-center py-20 text-xs text-neutral-500">
                  Your cart is empty. Add items from the catalog.
                </div>
              ) : !isCheckingOut ? (
                cart.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-neutral-950 border border-neutral-850 text-xs gap-3">
                    <div className="space-y-1">
                      <div className="font-bold text-neutral-200">{item.product.name}</div>
                      {item.variantName && (
                        <div className="text-[10px] text-amber-500 font-semibold">{item.variantName}</div>
                      )}
                      <div className="font-mono text-neutral-500">Unit Price: ৳{item.unitPrice.toFixed(2)}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Qty increment controls */}
                      <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
                        <button 
                          onClick={() => updateCartQty(idx, -1)}
                          className="p-1 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 font-bold font-mono text-neutral-200">{item.quantity}</span>
                        <button 
                          onClick={() => updateCartQty(idx, 1)}
                          className="p-1 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="text-right w-20 font-bold font-mono text-neutral-100">
                        ৳{(item.quantity * item.unitPrice).toFixed(2)}
                      </div>

                      <button 
                        onClick={() => removeFromCart(idx)}
                        className="text-neutral-500 hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                /* CHECKOUT SUBMIT FORM */
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block mb-2">Delivery Information</span>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-neutral-500" />
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Abul Kalam"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-neutral-500" />
                      Mobile Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 01711223344"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-neutral-400 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-neutral-500" />
                      Delivery Address
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. House 12, Road 4, Sector 6, Uttara, Dhaka"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500"
                    />
                  </div>
                  
                  <div className="p-4 rounded-xl border border-neutral-850 bg-neutral-950/40 text-[10px] text-neutral-400 space-y-1 leading-relaxed">
                    <span className="font-bold text-amber-500 uppercase block mb-1">Shipping Note</span>
                    <li>Cash on Delivery (COD) available for all components.</li>
                    <li>Delivery is executed within 24-48 hours.</li>
                  </div>

                  <button
                    type="submit"
                    disabled={orderSubmitting}
                    className="w-full bg-emerald-500 hover:bg-emerald-450 disabled:bg-neutral-850 text-black font-black py-3 rounded-xl transition-all cursor-pointer select-none flex items-center justify-center gap-2"
                  >
                    {orderSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        Place Order (৳{cartTotal.toFixed(2)})
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
                  <span className="text-xs text-neutral-450 font-bold uppercase tracking-wider">Subtotal:</span>
                  <span className="text-lg font-black font-mono text-neutral-100">৳{cartTotal.toFixed(2)}</span>
                </div>

                {!isCheckingOut ? (
                  <button
                    onClick={() => setIsCheckingOut(true)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl transition-all cursor-pointer select-none flex items-center justify-center gap-1.5"
                  >
                    Checkout Order
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCheckingOut(false)}
                    className="w-full bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 text-neutral-300 font-bold py-3 rounded-xl transition-colors cursor-pointer select-none"
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
