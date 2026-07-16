'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import { 
  getOnlineOrdersAction, 
  updateOnlineOrderStatusAction, 
  convertOnlineOrderToInvoiceAction 
} from '@/lib/actions';
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  Printer, 
  Check, 
  X, 
  DollarSign, 
  Loader2,
  AlertCircle
} from 'lucide-react';

interface OnlineOrder {
  id: number;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  orderDate: string;
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  totalAmount: number;
  items: {
    productId: number;
    variantId?: number | null;
    quantity: number;
    unitPrice: number;
    name: string;
  }[];
}

export default function OnlineOrdersPage() {
  const { language, toast } = useLanguage();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'CANCELLED'>('PENDING');
  const [loading, setLoading] = useState(true);
  
  // Selected Order details modal/view
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  // Conversion Modal states
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [expectedPaymentDate, setExpectedPaymentDate] = useState('');
  const [submittingApprove, setSubmittingApprove] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getOnlineOrdersAction();
      setOrders(data as OnlineOrder[]);
    } catch (err) {
      console.error(err);
      toast(language === 'en' ? 'Failed to load online orders' : 'অনলাইন অর্ডার লোড করতে ব্যর্থ', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm(language === 'en' ? 'Are you sure you want to CANCEL this order?' : 'আপনি কি নিশ্চিত যে এই অর্ডারটি বাতিল করতে চান?')) {
      return;
    }
    try {
      const res = await updateOnlineOrderStatusAction(orderId, 'CANCELLED');
      if (res.success) {
        toast(language === 'en' ? 'Order cancelled successfully' : 'অর্ডার সফলভাবে বাতিল করা হয়েছে', 'success');
        setSelectedOrder(null);
        loadOrders();
      } else {
        toast(res.error || 'Failed to update status', 'error');
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Error updating order', 'error');
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || submittingApprove) return;

    const finalPaid = paidAmount === '' ? selectedOrder.totalAmount : paidAmount;
    const dueAmount = Math.max(0, selectedOrder.totalAmount - finalPaid);

    if (dueAmount > 0 && !expectedPaymentDate) {
      toast(language === 'en' ? 'Please set expected collection date for due amount' : 'বকেয়া টাকার জন্য সম্ভাব্য আদায়ের তারিখ দিন', 'error');
      return;
    }

    setSubmittingApprove(true);
    try {
      const res = await convertOnlineOrderToInvoiceAction(
        selectedOrder.id,
        finalPaid,
        dueAmount > 0 ? expectedPaymentDate : undefined
      );

      if (res.success) {
        toast(
          language === 'en'
            ? `Order approved! Saved as sales invoice ${res.manualInvoiceNo}`
            : `অর্ডার অনুমোদিত হয়েছে! নতুন ইনভয়েস নং: ${res.manualInvoiceNo}`,
          'success'
        );
        setShowApproveModal(false);
        setSelectedOrder(null);
        setPaidAmount('');
        setExpectedPaymentDate('');
        loadOrders();
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || 'Conversion failed', 'error');
    } finally {
      setSubmittingApprove(false);
    }
  };

  const filteredOrders = orders.filter(o => filterStatus === 'ALL' || o.status === filterStatus);

  return (
    <div className="space-y-6 font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-wide flex items-center gap-2 text-neutral-100">
            <ShoppingCart className="h-5 w-5 text-amber-500" />
            {language === 'en' ? 'Online Orders Panel' : 'অনলাইন অর্ডার প্যানেল'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' 
              ? 'Review pending customer requests, approve orders, and auto-generate sales invoices.' 
              : 'গ্রাহকদের করা অর্ডার রিভিউ করুন, অনুমোদন করে সরাসরি বিক্রয় মেমোতে রূপান্তর করুন।'}
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex bg-neutral-900/60 p-1 border border-neutral-850 rounded-xl">
          {(['PENDING', 'APPROVED', 'CANCELLED', 'ALL'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                filterStatus === status
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-neutral-400 hover:text-neutral-250'
              }`}
            >
              {status === 'ALL' ? (language === 'en' ? 'All' : 'সব') : status}
            </button>
          ))}
        </div>
      </div>

      {/* WORKSPACE CONTENT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: ORDERS LIST */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/10 p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              {language === 'en' ? 'Incoming Orders List' : 'অর্ডারের তালিকা'} ({filteredOrders.length})
            </h2>

            {loading ? (
              <div className="text-center py-20 text-xs text-neutral-500 flex flex-col items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                Loading orders...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-20 text-xs text-neutral-600">
                No orders found under this category.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {filteredOrders.map((order) => {
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      onClick={() => { setSelectedOrder(order); setShowApproveModal(false); }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                        isSelected
                          ? 'bg-amber-500/10 border-amber-500 text-neutral-100'
                          : 'bg-neutral-900/30 border-neutral-850 hover:bg-neutral-900/50 hover:border-neutral-800 text-neutral-350'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-neutral-200">{order.orderNo}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                            order.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20'
                              : order.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-450 border border-rose-500/20'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1">
                          <User className="h-3 w-3" /> {order.customerName} | <Phone className="h-3 w-3" /> {order.customerPhone}
                        </div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          Date: {order.orderDate}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-sm text-neutral-200">৳{order.totalAmount.toFixed(2)}</div>
                        <div className="text-[10px] text-neutral-500">{order.items.length} items</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: DETAIL PANEL */}
        <div className="space-y-4">
          {selectedOrder ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/25 p-5 space-y-6 shadow-xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-br from-amber-500/10 to-transparent blur-xl pointer-events-none" />
              
              <div className="flex justify-between items-start border-b border-neutral-800 pb-4">
                <div>
                  <span className="text-[9px] uppercase tracking-widest text-amber-500 font-mono block">Order details</span>
                  <h3 className="text-lg font-black font-mono text-neutral-100 mt-0.5">{selectedOrder.orderNo}</h3>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md uppercase ${
                  selectedOrder.status === 'PENDING'
                    ? 'bg-amber-500/10 text-amber-400'
                    : selectedOrder.status === 'APPROVED'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-rose-500/10 text-rose-450'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>

              {/* Customer summary */}
              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-neutral-550 block font-semibold uppercase">Customer Name</span>
                    <span className="text-neutral-250 font-bold">{selectedOrder.customerName}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-neutral-550 block font-semibold uppercase">Contact Phone</span>
                    <span className="text-neutral-250 font-bold font-mono">{selectedOrder.customerPhone}</span>
                  </div>
                </div>

                {selectedOrder.customerAddress && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-neutral-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] text-neutral-550 block font-semibold uppercase">Delivery Address</span>
                      <span className="text-neutral-350">{selectedOrder.customerAddress}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Items breakdown list */}
              <div className="space-y-2 border-t border-neutral-800 pt-4">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">Order Items</span>
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-neutral-950/65 border border-neutral-850">
                      <div>
                        <div className="font-bold text-neutral-300">{item.name}</div>
                        <div className="text-[10px] text-neutral-500 font-mono">
                          ৳{item.unitPrice.toFixed(0)} x {item.quantity}
                        </div>
                      </div>
                      <div className="font-mono text-neutral-200 font-bold">
                        ৳{(item.quantity * item.unitPrice).toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grand Total */}
              <div className="flex justify-between items-center border-t border-neutral-800 pt-4 font-bold">
                <span className="text-xs text-neutral-450 uppercase">{language === 'en' ? 'Grand Total:' : 'সর্বমোট মূল্য:'}</span>
                <span className="text-lg font-black font-mono text-neutral-100">৳{selectedOrder.totalAmount.toFixed(2)}</span>
              </div>

              {/* ACTIONS CONTROLS */}
              {selectedOrder.status === 'PENDING' && (
                <div className="flex gap-3 border-t border-neutral-850 pt-4 no-print select-none">
                  {/* Cancel order button */}
                  <button
                    onClick={() => handleCancelOrder(selectedOrder.id)}
                    className="flex-1 py-2.5 rounded-xl border border-rose-950 bg-rose-950/10 text-rose-450 hover:bg-rose-950/30 transition-colors font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                    {language === 'en' ? 'Cancel Request' : 'বাতিল করুন'}
                  </button>

                  {/* Open convert invoice modal */}
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-450 text-black font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {language === 'en' ? 'Approve & Memo' : 'অনুমোদন ও মেমো'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-900/5 p-8 text-center text-xs text-neutral-500">
              Select an order from the list to view its complete details and process billing.
            </div>
          )}
        </div>
      </div>

      {/* APPROVE AND CONVERT INVOICE MODAL */}
      {showApproveModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl animate-scale-up">
            <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
              <div>
                <h3 className="font-bold text-neutral-250">{language === 'en' ? 'Sales Checkout approval' : 'অনলাইন বিক্রয় অনুমোদন'}</h3>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">Order Ref: {selectedOrder.orderNo}</p>
              </div>
              <button 
                onClick={() => setShowApproveModal(false)}
                className="p-1 rounded-lg border border-neutral-800 text-neutral-450 hover:text-neutral-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div className="bg-neutral-950 p-3 rounded-xl border border-neutral-850 flex justify-between items-center text-xs">
                <span className="text-neutral-500 font-bold uppercase">Order Total:</span>
                <span className="font-mono text-neutral-200 font-bold">৳{selectedOrder.totalAmount.toFixed(2)}</span>
              </div>

              {/* Paid Amount */}
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-400 flex items-center gap-1 font-semibold">
                  <DollarSign className="h-3.5 w-3.5 text-neutral-500" />
                  {language === 'en' ? 'Paid Amount BDT' : 'পরিশোধিত টাকা'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`৳${selectedOrder.totalAmount.toFixed(2)}`}
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none focus:border-amber-500 font-mono"
                />
                <span className="text-[9px] text-neutral-500 block">
                  {language === 'en' ? 'Blank defaults to full amount' : 'ফাঁকা রাখলে পুরো টাকা পরিশোধিত বলে গণ্য হবে'}
                </span>
              </div>

              {/* Expected Payment Date (If due exists) */}
              {(paidAmount !== '' && Number(paidAmount) < selectedOrder.totalAmount) && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="text-xs text-neutral-400 flex items-center gap-1.5 font-semibold">
                    <Calendar className="h-3.5 w-3.5 text-amber-500" />
                    {language === 'en' ? 'Expected Due Return Date *' : 'বাকি পরিশোধের সম্ভাব্য তারিখ *'}
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

              {/* Submit approval action */}
              <button
                type="submit"
                disabled={submittingApprove}
                className="w-full bg-emerald-500 hover:bg-emerald-450 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed text-black font-black py-3 rounded-xl transition-all cursor-pointer flex justify-center items-center gap-2"
              >
                {submittingApprove ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm Approval
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
