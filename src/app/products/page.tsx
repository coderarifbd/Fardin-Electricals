'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/lib/context/LanguageContext';
import Image from 'next/image';
import Link from 'next/link';
import { 
  getProductsAction, 
  addProductAction, 
  updateProductAction, 
  deleteProductAction,
  addVariantAction, 
  updateVariantAction, 
  deleteVariantAction 
} from '@/lib/actions';
import { 
  Search, 
  ShoppingBag, 
  Layers, 
  AlertTriangle, 
  Barcode, 
  Calendar,
  LayoutGrid,
  List,
  Plus,
  Edit,
  Trash2,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react';

interface Variant {
  id?: number;
  productId?: number;
  name: string;
  currentStock?: number;
  minStockAlert: number;
  movingAverageCost?: number;
  retailPrice?: number;
  barcode?: string | null;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
}

interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  retailPrice: number;
  barcode?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  unit?: string;
  hasVariants?: boolean;
  variants?: Variant[];
  priceHistory?: { date: string; price: number }[];
}

interface Toast {
  id: number;
  type: 'success' | 'error';
  message: string;
}

const UNIT_OPTIONS = ['পিছ', 'গজ', 'ফুট', 'মিটার', 'কয়েল', 'কেজি'];

const FORM_DEFAULTS = {
  name: '',
  category: '',
  minStockAlert: 0,
  barcode: '',
  description: '',
  unit: 'পিছ',
  retailPrice: 0,
};

export default function ProductsPage() {
  const { language, t } = useLanguage();
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [expandedVariantsId, setExpandedVariantsId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (type: 'success' | 'error', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Add Product Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState(FORM_DEFAULTS);
  const [addVariants, setAddVariants] = useState<Variant[]>([]);
  const [tempVariantAttrKey, setTempVariantAttrKey] = useState('');
  const [tempVariantAttrVal, setTempVariantAttrVal] = useState('');
  const [tempVariantBarcode, setTempVariantBarcode] = useState('');
  const [tempVariantMinAlert, setTempVariantMinAlert] = useState(0);
  const [tempVariantRetailPrice, setTempVariantRetailPrice] = useState<number | ''>('');
  const [tempVariantImageUrl, setTempVariantImageUrl] = useState<string | null>(null);
  const [mainProductImageUrl, setMainProductImageUrl] = useState<string | null>(null);

  // Matrix Configuration inside Add Modal
  const [variantTab, setVariantTab] = useState<'MANUAL' | 'MATRIX'>('MANUAL');
  const [matrixGroups, setMatrixGroups] = useState<{ name: string; values: string[] }[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupValues, setNewGroupValues] = useState('');

  // Edit Product Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState(FORM_DEFAULTS);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);

  // Inline variant edit state inside Edit Modal
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editingVariantAttrKey, setEditingVariantAttrKey] = useState('');
  const [editingVariantAttrVal, setEditingVariantAttrVal] = useState('');
  const [editingVariantBarcode, setEditingVariantBarcode] = useState('');
  const [editingVariantRetailPrice, setEditingVariantRetailPrice] = useState<number | ''>('');
  const [deletingVariantId, setDeletingVariantId] = useState<number | null>(null);

  // Inline variant add state inside Edit Modal
  const [showInlineAddVariantForm, setShowInlineAddVariantForm] = useState(false);
  const [newVariantAttrKey, setNewVariantAttrKey] = useState('');
  const [newVariantAttrVal, setNewVariantAttrVal] = useState('');
  const [newVariantBarcode, setNewVariantBarcode] = useState('');
  const [newVariantRetailPrice, setNewVariantRetailPrice] = useState<number | ''>('');
  const [newVariantStock, setNewVariantStock] = useState<number | ''>('');

  // Matrix Configuration inside Edit Modal
  const [editVariantTab, setEditVariantTab] = useState<'MANUAL' | 'MATRIX'>('MANUAL');
  const [editMatrixGroups, setEditMatrixGroups] = useState<{ name: string; values: string[] }[]>([]);
  const [editNewGroupName, setEditNewGroupName] = useState('');
  const [editNewGroupValues, setEditNewGroupValues] = useState('');
  const [editMatrixVariants, setEditMatrixVariants] = useState<Variant[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // File upload refs
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const variantFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProductsAction();
      setProductsList(data as Product[]);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle local image file upload mock
  const uploadFile = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) return data.url;
      throw new Error(data.error || 'Failed to upload');
    } catch (err) {
      console.error('File upload failed, using local blob fallback', err);
      return URL.createObjectURL(file);
    }
  };

  // Add Variant helper in Modal
  const handleAddVariantItem = () => {
    const attrKey = tempVariantAttrKey.trim() || 'Option';
    const attrVal = tempVariantAttrVal.trim();

    if (!attrVal) {
      addToast('error', language === 'en' ? 'Variation value is required' : 'ভেরিয়েশনের মান প্রয়োজন');
      return;
    }
    const combinedName = `${attrKey}: ${attrVal}`;
    if (addVariants.some(v => v.name.toLowerCase() === combinedName.toLowerCase())) {
      addToast('error', language === 'en' ? 'Duplicate variant' : 'একই ভেরিয়েশন ইতিমধ্যে রয়েছে');
      return;
    }
    setAddVariants(prev => [
      ...prev,
      {
        name: combinedName,
        barcode: tempVariantBarcode.trim() || null,
        minStockAlert: tempVariantMinAlert,
        imageUrl: tempVariantImageUrl,
        attributes: { [attrKey]: attrVal },
        retailPrice: tempVariantRetailPrice === '' ? 0 : Number(tempVariantRetailPrice)
      }
    ]);
    setTempVariantAttrKey('');
    setTempVariantAttrVal('');
    setTempVariantBarcode('');
    setTempVariantMinAlert(0);
    setTempVariantRetailPrice('');
    setTempVariantImageUrl(null);
  };

  // Remove Variant helper in Add Modal
  const handleRemoveVariantItem = (idx: number) => {
    setAddVariants(prev => prev.filter((_, i) => i !== idx));
  };

  // Matrix Groups Handlers
  const handleAddMatrixGroup = () => {
    if (!newGroupName.trim() || !newGroupValues.trim()) {
      addToast('error', language === 'en' ? 'Group name and values are required.' : 'গ্রুপের নাম এবং ভ্যালু প্রয়োজন।');
      return;
    }
    
    const parsedValues = newGroupValues
      .split(',')
      .map(v => v.trim())
      .filter(v => v !== '');
      
    if (parsedValues.length === 0) {
      addToast('error', language === 'en' ? 'Please enter valid comma-separated values.' : 'অনুগ্রহ করে কমা দিয়ে আলাদা করা ভ্যালু লিখুন।');
      return;
    }
    
    if (matrixGroups.some(g => g.name.toLowerCase() === newGroupName.trim().toLowerCase())) {
      addToast('error', language === 'en' ? 'Group already exists.' : 'এই গ্রুপটি ইতিমধ্যে রয়েছে।');
      return;
    }
    
    setMatrixGroups(prev => [
      ...prev,
      {
        name: newGroupName.trim(),
        values: parsedValues
      }
    ]);
    
    setNewGroupName('');
    setNewGroupValues('');
  };

  const handleRemoveMatrixGroup = (idx: number) => {
    setMatrixGroups(prev => prev.filter((_, i) => i !== idx));
  };

  // Cartesian product calculator
  const generateCartesianProduct = (groups: { name: string; values: string[] }[]) => {
    if (groups.length === 0) return [];
    
    let result: Record<string, string>[] = groups[0].values.map(val => ({
      [groups[0].name]: val
    }));
    
    for (let i = 1; i < groups.length; i++) {
      const currentGroup = groups[i];
      const temp: Record<string, string>[] = [];
      for (const res of result) {
        for (const val of currentGroup.values) {
          temp.push({
            ...res,
            [currentGroup.name]: val
          });
        }
      }
      result = temp;
    }
    return result;
  };

  const handleGenerateMatrix = () => {
    if (matrixGroups.length === 0) {
      addToast('error', language === 'en' ? 'Please add at least one attribute group first.' : 'অনুগ্রহ করে প্রথমে অন্তত একটি অ্যাট্রিবিউট গ্রুপ যোগ করুন।');
      return;
    }
    
    const combinations = generateCartesianProduct(matrixGroups);
    const newVariantsList: Variant[] = combinations.map(combo => {
      const name = Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(' - ');
      return {
        name,
        minStockAlert: 0,
        barcode: null,
        imageUrl: null,
        attributes: combo
      };
    });
    
    setAddVariants(prev => {
      const filtered = newVariantsList.filter(nv => !prev.some(pv => pv.name.toLowerCase() === nv.name.toLowerCase()));
      return [...prev, ...filtered];
    });
    
    setMatrixGroups([]);
    addToast('success', language === 'en' ? `Generated ${combinations.length} combinations!` : `${combinations.length}টি কম্বিনেশন জেনারেট করা হয়েছে!`);
  };

  // Save new Product
  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.category.trim()) {
      setFormError(language === 'en' ? 'Product name and category are required.' : 'পণ্য ও ক্যাটাগরির নাম আবশ্যিক।');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: addForm.name.trim(),
      category: addForm.category.trim(),
      minStockAlert: addForm.minStockAlert,
      barcode: addForm.barcode.trim() || null,
      imageUrl: mainProductImageUrl,
      variants: addVariants.length > 0 ? addVariants : undefined,
      description: addForm.description.trim() || null,
      unit: addForm.unit || 'পিছ',
      retailPrice: addForm.retailPrice || 0
    };

    const res = await addProductAction(payload);
    setSubmitting(false);

    if (res.success) {
      addToast('success', language === 'en' ? 'Product saved successfully!' : 'পণ্য সফলভাবে তালিকাভুক্ত হয়েছে!');
      setShowAddModal(false);
      setAddForm(FORM_DEFAULTS);
      setAddVariants([]);
      setMainProductImageUrl(null);
      loadProducts();
    } else {
      setFormError(res.error || 'Failed to save product.');
    }
  };

  // Edit Product Submit
  const handleEditProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    if (!editForm.name.trim() || !editForm.category.trim()) {
      setFormError(language === 'en' ? 'Product name and category are required.' : 'পণ্য ও ক্যাটাগরির নাম আবশ্যিক।');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    const res = await updateProductAction(editProduct.id, {
      name: editForm.name.trim(),
      category: editForm.category.trim(),
      minStockAlert: editForm.minStockAlert,
      barcode: editForm.barcode.trim() || null,
      imageUrl: editImageUrl,
      description: editForm.description.trim() || null,
      unit: editForm.unit || 'পিছ',
      retailPrice: editForm.retailPrice || 0
    });
    setSubmitting(false);

    if (res.success) {
      addToast('success', language === 'en' ? 'Product updated successfully!' : 'পণ্য সফলভাবে আপডেট হয়েছে!');
      setShowEditModal(false);
      loadProducts();
    } else {
      setFormError(res.error || 'Failed to update product.');
    }
  };

  // Delete Product Submit
  const handleDeleteProduct = async (id: number) => {
    if (!confirm(language === 'en' ? 'Are you sure you want to delete this product? All related variants will be deleted.' : 'পণ্যটি ডিলিট করতে চান? সব ভেরিয়েশনও ডিলিট হবে।')) return;
    const res = await deleteProductAction(id);
    if (res.success) {
      addToast('success', language === 'en' ? 'Product deleted successfully.' : 'পণ্য সফলভাবে ডিলিট করা হয়েছে।');
      setShowEditModal(false);
      loadProducts();
    } else {
      addToast('error', res.error || 'Failed to delete product.');
    }
  };

  // Save new variant added inline in edit modal
  const handleSaveInlineAddVariant = async () => {
    if (!editProduct) return;
    const attrKey = newVariantAttrKey.trim() || 'Option';
    const attrVal = newVariantAttrVal.trim();

    if (!attrVal) {
      addToast('error', language === 'en' ? 'Variation value is required.' : 'ভেরিয়েশনের মান লিখুন।');
      return;
    }

    const res = await addVariantAction({
      productId: editProduct.id,
      name: `${attrKey}: ${attrVal}`,
      barcode: newVariantBarcode.trim() || null,
      attributes: { [attrKey]: attrVal },
      retailPrice: newVariantRetailPrice === '' ? 0 : Number(newVariantRetailPrice),
      currentStock: newVariantStock === '' ? 0 : Number(newVariantStock)
    });

    if (res.success) {
      addToast('success', language === 'en' ? 'Variant added!' : 'ভেরিয়েশন যোগ হয়েছে!');
      setNewVariantAttrKey('');
      setNewVariantAttrVal('');
      setNewVariantBarcode('');
      setNewVariantRetailPrice('');
      setNewVariantStock('');
      setShowInlineAddVariantForm(false);
      
      const updatedProducts = await getProductsAction();
      setProductsList(updatedProducts as Product[]);
      const freshProduct = (updatedProducts as Product[]).find(p => p.id === editProduct.id);
      if (freshProduct) setEditProduct(freshProduct);
    } else {
      addToast('error', res.error || 'Failed to add variant.');
    }
  };

  // Save inline variant edit
  const handleSaveInlineVariantEdit = async (variantId: number) => {
    const attrKey = editingVariantAttrKey.trim() || 'Option';
    const attrVal = editingVariantAttrVal.trim();

    if (!attrVal) {
      addToast('error', language === 'en' ? 'Variation value is required.' : 'ভেরিয়েশনের মান লিখুন।');
      return;
    }
    const res = await updateVariantAction(variantId, {
      name: `${attrKey}: ${attrVal}`,
      barcode: editingVariantBarcode.trim() || null,
      retailPrice: editingVariantRetailPrice === '' ? 0 : Number(editingVariantRetailPrice),
      attributes: { [attrKey]: attrVal }
    });

    if (res.success) {
      addToast('success', language === 'en' ? 'Variant updated!' : 'ভেরিয়েশন আপডেট হয়েছে!');
      setEditingVariantId(null);
      const updatedProducts = await getProductsAction();
      setProductsList(updatedProducts as Product[]);
      if (editProduct) {
        const freshProduct = (updatedProducts as Product[]).find(p => p.id === editProduct.id);
        if (freshProduct) setEditProduct(freshProduct);
      }
    } else {
      addToast('error', res.error || 'Failed to update variant.');
    }
  };

  // Confirm delete variant inline
  const handleDeleteVariantItemConfirm = async (variantId: number) => {
    const res = await deleteVariantAction(variantId);
    if (res.success) {
      addToast('success', language === 'en' ? 'Variant deleted!' : 'ভেরিয়েশন ডিলিট করা হয়েছে!');
      setDeletingVariantId(null);
      const updatedProducts = await getProductsAction();
      setProductsList(updatedProducts as Product[]);
      if (editProduct) {
        const freshProduct = (updatedProducts as Product[]).find(p => p.id === editProduct.id);
        if (freshProduct) setEditProduct(freshProduct);
      }
    } else {
      addToast('error', res.error || 'Failed to delete variant.');
    }
  };

  // Edit Modal Matrix Handlers
  const handleEditAddMatrixGroup = () => {
    if (!editNewGroupName.trim() || !editNewGroupValues.trim()) {
      addToast('error', language === 'en' ? 'Group name and values are required.' : 'গ্রুপের নাম এবং ভ্যালু প্রয়োজন।');
      return;
    }
    
    const parsedValues = editNewGroupValues
      .split(',')
      .map(v => v.trim())
      .filter(v => v !== '');
      
    if (parsedValues.length === 0) {
      addToast('error', language === 'en' ? 'Please enter valid comma-separated values.' : 'অনুগ্রহ করে কমা দিয়ে আলাদা করা ভ্যালু লিখুন।');
      return;
    }
    
    if (editMatrixGroups.some(g => g.name.toLowerCase() === editNewGroupName.trim().toLowerCase())) {
      addToast('error', language === 'en' ? 'Group already exists.' : 'এই গ্রুপটি ইতিমধ্যে রয়েছে।');
      return;
    }
    
    setEditMatrixGroups(prev => [
      ...prev,
      {
        name: editNewGroupName.trim(),
        values: parsedValues
      }
    ]);
    
    setEditNewGroupName('');
    setEditNewGroupValues('');
  };

  const handleEditRemoveMatrixGroup = (idx: number) => {
    setEditMatrixGroups(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEditGenerateMatrix = () => {
    if (editMatrixGroups.length === 0) {
      addToast('error', language === 'en' ? 'Please add at least one attribute group first.' : 'অনুগ্রহ করে প্রথমে অন্তত একটি অ্যাট্রিবিউট গ্রুপ যোগ করুন।');
      return;
    }
    
    const combinations = generateCartesianProduct(editMatrixGroups);
    const newVariantsList = combinations.map(combo => {
      const name = Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(' - ');
      return {
        name,
        minStockAlert: 0,
        barcode: null,
        imageUrl: null,
        attributes: combo,
        retailPrice: 0,
        currentStock: 0
      };
    });
    
    setEditMatrixVariants(prev => {
      const filtered = newVariantsList.filter(nv => !prev.some(pv => pv.name.toLowerCase() === nv.name.toLowerCase()));
      return [...prev, ...filtered];
    });
    
    setEditMatrixGroups([]);
  };

  const handleSaveInlineMatrixVariants = async () => {
    if (!editProduct || editMatrixVariants.length === 0) return;
    setSubmitting(true);
    setFormError(null);

    let successCount = 0;
    let failCount = 0;

    for (const v of editMatrixVariants) {
      const res = await addVariantAction({
        productId: editProduct.id,
        name: v.name,
        barcode: v.barcode || null,
        attributes: v.attributes || null,
        retailPrice: v.retailPrice || 0,
        currentStock: v.currentStock || 0
      });
      if (res.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    setSubmitting(false);

    if (successCount > 0) {
      addToast('success', language === 'en' ? `Added ${successCount} variations!` : `${successCount}টি ভেরিয়েশন যোগ হয়েছে!`);
      if (failCount > 0) {
        addToast('error', language === 'en' ? `Failed to add ${failCount} variations.` : `${failCount}টি ভেরিয়েশন যোগ করা যায়নি।`);
      }
      
      setEditMatrixVariants([]);
      setShowInlineAddVariantForm(false);

      const updatedProducts = await getProductsAction();
      setProductsList(updatedProducts as Product[]);
      const freshProduct = (updatedProducts as Product[]).find(p => p.id === editProduct.id);
      if (freshProduct) setEditProduct(freshProduct);
    } else {
      addToast('error', language === 'en' ? 'Failed to add variations.' : 'ভেরিয়েশন যোগ করা যায়নি।');
    }
  };

  // Autocomplete search categories
  const categories = ['ALL', ...Array.from(new Set(productsList.map(p => p.category)))];

  const filteredProducts = productsList.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.barcode && p.barcode.includes(searchQuery)) ||
                          (p.variants && p.variants.some(v => v.name.toLowerCase().includes(searchQuery.toLowerCase()) || (v.barcode && v.barcode.includes(searchQuery))));
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 font-sans text-neutral-100">
      
      {/* Hidden file inputs */}
      <input
        ref={mainFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = await uploadFile(file);
            setMainProductImageUrl(url);
          }
        }}
      />

      <input
        ref={variantFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = await uploadFile(file);
            setTempVariantImageUrl(url);
          }
        }}
      />

      <input
        ref={editFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = await uploadFile(file);
            setEditImageUrl(url);
          }
        }}
      />

      {/* Toast alerts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold pointer-events-auto border animate-slide-in ${
              toast.type === 'success'
                ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                : 'bg-rose-950 border-rose-800 text-rose-300'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-900 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-100 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-amber-500" />
            {language === 'en' ? 'Product Inventory Directory' : 'পণ্য স্টক ও মূল্য তালিকা'}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {language === 'en' 
              ? 'Manage products, attributes, and combinations. Initial stocks are registered here and updated dynamically.' 
              : 'পণ্য, এট্রিবিউট এবং তাদের কম্বিনেশনসমূহ পরিচালনা করুন। নতুন পণ্য যোগ করুন ও স্টক রেকর্ড ট্র্যাক করুন।'}
          </p>
        </div>
        <div className="flex gap-2.5">
          <Link
            href="/products/barcodes"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-neutral-850 bg-neutral-900/20 hover:bg-neutral-900/40 text-neutral-300 hover:text-neutral-100 text-xs font-semibold transition-all select-none"
          >
            <Barcode className="h-4 w-4 text-purple-400" />
            {language === 'en' ? 'Print Barcodes' : 'বারকোড প্রিন্ট'}
          </Link>
          <button
            onClick={() => {
              setAddForm(FORM_DEFAULTS);
              setAddVariants([]);
              setMainProductImageUrl(null);
              setMatrixGroups([]);
              setFormError(null);
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all shadow-lg hover:shadow-amber-500/10 shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {language === 'en' ? 'Add Product' : 'নতুন পণ্য যোগ করুন'}
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600" />
          <input
            type="text"
            placeholder={language === 'en' ? 'Search product or variant...' : 'পণ্যের নাম বা ভেরিয়েশন দিয়ে খুঁজুন...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-850 bg-neutral-900/60 text-xs text-neutral-202 placeholder-neutral-600 outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-between sm:justify-start">
          <div className="relative w-40 sm:w-48 shrink-0">
            <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-600 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-neutral-855 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-all appearance-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="bg-neutral-950 text-neutral-300">
                  {cat === 'ALL' ? (language === 'en' ? 'All Categories' : 'সব ক্যাটাগরি') : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex rounded-xl border border-neutral-850 bg-neutral-900/60 p-1 select-none">
            <button
              onClick={() => setViewMode('GRID')}
              className={`rounded-lg p-1.5 transition-colors ${viewMode === 'GRID' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-neutral-200'}`}
              title={language === 'en' ? 'Grid View' : 'গ্রিড ভিউ'}
            >
              <LayoutGrid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`rounded-lg p-1.5 transition-colors ${viewMode === 'LIST' ? 'bg-amber-500 text-black' : 'text-neutral-400 hover:text-neutral-200'}`}
              title={language === 'en' ? 'List View' : 'লিস্ট ভিউ'}
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main product display */}
      {loading ? (
        <div className="text-center py-20 text-xs text-neutral-500 font-mono">
          {t('loading')}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 p-20 text-center text-xs text-neutral-550">
          {language === 'en' ? 'No products registered matching filter.' : 'কোনো পণ্য খুঁজে পাওয়া যায়নি।'}
        </div>
      ) : viewMode === 'GRID' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isLowStock = !p.hasVariants && p.currentStock <= p.minStockAlert;
            const isNegative = !p.hasVariants && p.currentStock < 0;
            const aggregateStock = p.hasVariants 
              ? (p.variants || []).reduce((sum, v) => sum + (v.currentStock || 0), 0)
              : p.currentStock;

            return (
              <div 
                key={p.id}
                className="rounded-2xl border border-neutral-850 bg-neutral-900/20 p-5 space-y-4 hover:border-neutral-800 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-neutral-450 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-850">
                      {p.category}
                    </span>
                    <button
                      onClick={() => {
                        setEditProduct(p);
                        setEditForm({
                          name: p.name,
                          category: p.category,
                          minStockAlert: p.minStockAlert,
                          barcode: p.barcode || '',
                          description: p.description || '',
                          unit: p.unit || 'পিছ',
                          retailPrice: p.retailPrice || 0
                        });
                        setEditImageUrl(p.imageUrl || null);
                        setFormError(null);
                        setShowEditModal(true);
                      }}
                      className="p-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-955 text-neutral-450 hover:text-amber-500 transition-all"
                      title="Edit Product & Variants"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    {p.imageUrl ? (
                      <div className="relative w-12 h-12 rounded-lg border border-neutral-800 overflow-hidden shrink-0 bg-neutral-950">
                        <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-neutral-800 flex items-center justify-center shrink-0 bg-neutral-950/40">
                        <ShoppingBag className="h-5 w-5 text-neutral-700" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-neutral-200 tracking-tight leading-tight select-text">
                        {p.name}
                      </h3>
                      {p.barcode && (
                        <span className="text-[9px] font-mono text-neutral-500 flex items-center gap-1 mt-1" title="Barcode">
                          <Barcode className="h-2.5 w-2.5 text-neutral-600" />
                          {p.barcode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock metrics */}
                <div className="grid grid-cols-2 gap-4 bg-neutral-950/40 p-3 rounded-xl border border-neutral-900/60">
                  <div className="space-y-0.5">
                    <span className="text-[9px] text-neutral-500 uppercase font-semibold block">
                      {p.hasVariants ? (language === 'en' ? 'Total Stock' : 'মোট স্টক') : (language === 'en' ? 'Current Stock' : 'বর্তমান স্টক')}
                    </span>
                    <span className={`text-sm font-black font-mono flex items-center gap-1 ${
                      isNegative 
                        ? 'text-rose-500' 
                        : isLowStock 
                        ? 'text-amber-500' 
                        : 'text-emerald-500'
                    }`}>
                      {aggregateStock} pcs
                      {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[9px] text-neutral-500 uppercase font-semibold block">
                      {p.hasVariants ? (language === 'en' ? 'Variations' : 'ভেরিয়েশন') : (language === 'en' ? 'Price Details' : 'মূল্য বিবরণী')}
                    </span>
                    <span className="text-xs font-bold text-neutral-300 font-mono">
                      {p.hasVariants ? `${p.variants?.length} types` : `Buy: ৳${p.movingAverageCost.toFixed(2)} / Sell: ৳${(p.retailPrice || 0).toFixed(2)}`}
                    </span>
                  </div>
                </div>

                {/* Expandable variants section */}
                {p.hasVariants && p.variants && p.variants.length > 0 && (
                  <div className="border-t border-neutral-900 pt-3">
                    <button
                      onClick={() => setExpandedVariantsId(expandedVariantsId === p.id ? null : p.id)}
                      className="w-full flex items-center justify-between text-[9px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors uppercase tracking-wider font-mono"
                    >
                      <span>{language === 'en' ? 'View Variation Inventory' : 'ভেরিয়েশন স্টক রেকর্ড'}</span>
                      {expandedVariantsId === p.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {expandedVariantsId === p.id && (
                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {p.variants.map((v) => (
                          <div key={v.id} className="flex justify-between items-center text-[10px] font-mono bg-neutral-950/60 p-2 rounded-lg border border-neutral-900/60">
                            <div>
                              <div className="font-bold text-neutral-300 flex items-center gap-1.5 flex-wrap">
                                {v.name}
                                {v.attributes && Object.entries(v.attributes).map(([key, val]) => {
                                  const lowerName = v.name.toLowerCase();
                                  if (lowerName.includes(key.toLowerCase()) && lowerName.includes(val.toLowerCase())) {
                                    return null;
                                  }
                                  return (
                                    <span key={key} className="text-[7.5px] font-extrabold bg-neutral-900 border border-neutral-800 text-neutral-450 px-1 py-0.5 rounded tracking-wide">
                                      {key}: {val}
                                    </span>
                                  );
                                })}
                              </div>
                              {v.barcode && <div className="text-[8px] text-neutral-600 mt-0.5">BC: {v.barcode}</div>}
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-500">{v.currentStock} pcs</div>
                              <div className="text-[8.5px] text-neutral-500">
                                Buy: ৳{v.movingAverageCost?.toFixed(2)} / Sell: ৳{(v.retailPrice || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cost History */}
                {p.priceHistory && p.priceHistory.length > 0 && !p.hasVariants && (
                  <div className="border-t border-neutral-900/80 pt-3">
                    <button
                      onClick={() => setExpandedHistoryId(expandedHistoryId === p.id ? null : p.id)}
                      className="w-full flex items-center justify-between text-[9px] font-semibold text-neutral-400 hover:text-neutral-200 transition-colors uppercase tracking-wider font-mono"
                    >
                      <span>{language === 'en' ? 'Purchase Cost History' : 'পূর্ববর্তী ক্রয়মূল্য রেকর্ড'}</span>
                      {expandedHistoryId === p.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    {expandedHistoryId === p.id && (
                      <div className="mt-2 space-y-1.5 max-h-24 overflow-y-auto">
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="rounded-2xl border border-neutral-850 bg-neutral-900/10 p-6 shadow-2xl backdrop-blur-md overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-neutral-300">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950/40 font-semibold text-neutral-400">
                <th className="p-3 w-10 text-center">#</th>
                <th className="p-3">{language === 'en' ? 'Product Name' : 'পণ্যের নাম'}</th>
                <th className="p-3 w-32">{language === 'en' ? 'Category' : 'ক্যাটাগরি'}</th>
                <th className="p-3 text-right w-32">{language === 'en' ? 'Stock' : 'স্টক'}</th>
                <th className="p-3 text-right w-44">{language === 'en' ? 'Price Details' : 'মূল্য বিবরণী'}</th>
                <th className="p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p, idx) => {
                const aggregateStock = p.hasVariants 
                  ? (p.variants || []).reduce((sum, v) => sum + (v.currentStock || 0), 0)
                  : p.currentStock;

                return (
                  <tr key={p.id} className="border-b border-neutral-800/60 hover:bg-neutral-900/10 transition-colors">
                    <td className="p-3 text-center text-neutral-500 font-mono">{idx + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        {p.imageUrl && (
                          <div className="relative w-8 h-8 rounded border border-neutral-800 overflow-hidden bg-neutral-950">
                            <Image src={p.imageUrl} alt={p.name} fill className="object-cover" unoptimized />
                          </div>
                        )}
                        <div>
                          <span className="font-bold text-neutral-200 block">{p.name}</span>
                          {p.hasVariants ? (
                            <span className="text-[9px] text-neutral-500 font-mono block">
                              Variants: {p.variants?.map(v => v.name).join(', ')}
                            </span>
                          ) : p.barcode ? (
                            <span className="text-[9px] text-neutral-500 font-mono block">
                              BC: {p.barcode}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="bg-neutral-950 border border-neutral-850 px-2 py-0.5 rounded text-[10px] text-neutral-400 font-semibold uppercase">
                        {p.category}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-neutral-300">
                      {aggregateStock} pcs
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-neutral-300 text-xs">
                      {p.hasVariants ? '—' : `Buy: ৳${p.movingAverageCost.toFixed(2)} / Sell: ৳${(p.retailPrice || 0).toFixed(2)}`}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setEditProduct(p);
                          setEditForm({
                            name: p.name,
                            category: p.category,
                            minStockAlert: p.minStockAlert,
                            barcode: p.barcode || '',
                            description: p.description || '',
                            unit: p.unit || 'পিছ',
                            retailPrice: p.retailPrice || 0
                          });
                          setEditImageUrl(p.imageUrl || null);
                          setFormError(null);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-955 text-neutral-450 hover:text-amber-500 transition-all"
                      >
                        <Edit className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── ADD PRODUCT MODAL ────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.65)' }}
        >
          <div className="w-full max-w-xl rounded-2xl border border-neutral-800 bg-neutral-955 shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ShoppingBag className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-sm font-bold text-neutral-100">
                  {language === 'en' ? 'Add New Product Record' : 'নতুন পণ্য তালিকাভুক্তি'}
                </h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Product Image */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  {language === 'en' ? 'Product Image' : 'পণ্যের ছবি'}
                </label>
                {mainProductImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-neutral-850 bg-neutral-900 h-28 group">
                    <Image src={mainProductImageUrl} alt="Preview" fill className="object-contain p-2" unoptimized />
                    <button
                      type="button"
                      onClick={() => setMainProductImageUrl(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-900/80 border border-rose-700 text-rose-300 hover:bg-rose-800 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => mainFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 p-5 cursor-pointer hover:border-neutral-600 transition-colors"
                  >
                    <ImagePlus className="h-5 w-5 text-neutral-550" />
                    <span className="text-[10px] text-neutral-550 font-bold">
                      {language === 'en' ? 'Upload main product cover image' : 'প্রধান পণ্যের ছবি যোগ করুন'}
                    </span>
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    {language === 'en' ? 'Product Name *' : 'পণ্যের নাম *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LED Tube Light"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-200 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    {language === 'en' ? 'Category *' : 'ক্যাটাগরি *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lighting, Cables"
                    value={addForm.category}
                    onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-200 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    {language === 'en' ? 'Product Description (Rich Info)' : 'পণ্যের বিবরণ (Rich Details)'}
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. This premium Havells LED bulb delivers ultra-bright illumination with 90% energy savings. Lifetime: 25000 hours."
                    value={addForm.description}
                    onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Unit of Measurement */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                    {language === 'en' ? 'Unit of Measurement (Sales Unit)' : 'বিক্রয় একক (Unit)'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {UNIT_OPTIONS.map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setAddForm({ ...addForm, unit: u })}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          addForm.unit === u
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-500">
                    {addForm.unit === 'গজ' || addForm.unit === 'ফুট' || addForm.unit === 'মিটার' || addForm.unit === 'কেজি'
                      ? '⚠️ এই একক-এ দশমিক পরিমাণ (যেমন ৫.৫) অর্ডার করা যাবে।'
                      : 'এই একক-এ শুধু পূর্ণসংখ্যা (১, ২, ৩...) অর্ডার করা যাবে।'}
                  </p>
                </div>
              </div>

              {/* General options (if no variants added yet) */}
              {addVariants.length === 0 && (
                <div className="grid grid-cols-3 gap-3 border-b border-neutral-905 pb-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      {language === 'en' ? 'Min Stock Alert' : 'সর্বনিম্ন স্টক এলার্ট'}
                    </label>
                    <input
                      type="number"
                      value={addForm.minStockAlert}
                      onChange={e => setAddForm({ ...addForm, minStockAlert: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-200 outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      {language === 'en' ? 'Retail Price (৳)' : 'খুচরা বিক্রয় মূল্য (৳)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={addForm.retailPrice || ''}
                      onChange={e => setAddForm({ ...addForm, retailPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      {language === 'en' ? 'Barcode' : 'বারকোড'}
                    </label>
                    <input
                      type="text"
                      placeholder="Optional barcode"
                      value={addForm.barcode}
                      onChange={e => setAddForm({ ...addForm, barcode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Variant Section */}
              <div className="border border-neutral-850 rounded-xl p-4 bg-neutral-950/40 space-y-4">
                <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-amber-500" />
                  {language === 'en' ? 'Configure Variations (Optional)' : 'ভেরিয়েশন অপশন যোগ করুন (ঐচ্ছিক)'}
                </span>

                {/* Tab selector */}
                <div className="flex border-b border-neutral-900 select-none">
                  <button
                    type="button"
                    onClick={() => setVariantTab('MANUAL')}
                    className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all uppercase tracking-wider ${
                      variantTab === 'MANUAL' 
                        ? 'border-amber-500 text-amber-500' 
                        : 'border-transparent text-neutral-500 hover:text-neutral-350'
                    }`}
                  >
                    {language === 'en' ? 'Manual Addition' : 'ম্যানুয়াল মোড'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariantTab('MATRIX')}
                    className={`flex-1 pb-2 text-[10px] font-bold text-center border-b-2 transition-all uppercase tracking-wider ${
                      variantTab === 'MATRIX' 
                        ? 'border-amber-500 text-amber-500' 
                        : 'border-transparent text-neutral-500 hover:text-neutral-350'
                    }`}
                  >
                    {language === 'en' ? 'Attribute Matrix (Size, Color)' : 'অ্যাট্রিবিউট ম্যাট্রিক্স মোড'}
                  </button>
                </div>

                {/* Tab Contents: MANUAL MODE */}
                {variantTab === 'MANUAL' && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase">
                          {language === 'en' ? 'Attribute Name' : 'অ্যাট্রিবিউট নাম'}
                        </label>
                        <input
                          type="text"
                          value={tempVariantAttrKey}
                          onChange={e => setTempVariantAttrKey(e.target.value)}
                          placeholder="e.g. Brand, Size, Color"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-855 bg-neutral-900 text-xs text-neutral-202 outline-none focus:border-amber-500 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase">
                          {language === 'en' ? 'Value *' : 'মান (Value) *'}
                        </label>
                        <input
                          type="text"
                          value={tempVariantAttrVal}
                          onChange={e => setTempVariantAttrVal(e.target.value)}
                          placeholder="e.g. BBS, 1.5 sqmm"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-855 bg-neutral-900 text-xs text-neutral-202 outline-none focus:border-amber-500 font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase">
                          {language === 'en' ? 'Retail Price (৳)' : 'খুচরা মূল্য (৳)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={tempVariantRetailPrice}
                          onChange={e => setTempVariantRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-855 bg-neutral-900 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-neutral-500 uppercase">
                          {language === 'en' ? 'Barcode' : 'বারকোড'}
                        </label>
                        <input
                          type="text"
                          value={tempVariantBarcode}
                          onChange={e => setTempVariantBarcode(e.target.value)}
                          placeholder="Barcode (optional)"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-855 bg-neutral-900 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => variantFileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-955 text-[10px] text-neutral-450 transition-all font-semibold"
                        >
                          <ImagePlus className="h-3.5 w-3.5" />
                          {tempVariantImageUrl ? (language === 'en' ? 'Uploaded ✓' : 'আপলোড হয়েছে ✓') : (language === 'en' ? 'Upload Image' : 'ছবি যোগ করুন')}
                        </button>
                        {tempVariantImageUrl && (
                          <button type="button" onClick={() => setTempVariantImageUrl(null)} className="text-[10px] text-rose-500 hover:underline">
                            {language === 'en' ? 'Clear' : 'মুছে ফেলুন'}
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVariantItem}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {language === 'en' ? 'Add Variant' : 'ভেরিয়েশন যোগ করুন'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab Contents: MATRIX GENERATOR MODE */}
                {variantTab === 'MATRIX' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-3 rounded-lg border border-neutral-900 bg-neutral-950/40 space-y-3">
                      <span className="text-[10.5px] font-bold text-neutral-450 uppercase tracking-wide">
                        {language === 'en' ? 'Add Attribute Group' : 'অ্যাট্রিবিউট গ্রুপ যোগ করুন'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-semibold text-neutral-500 uppercase">Group (e.g. Size, Color)</label>
                          <input
                            type="text"
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            placeholder="e.g. Size"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-855 bg-neutral-900 text-xs text-neutral-202 outline-none focus:border-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-semibold text-neutral-500 uppercase">Values (Comma-separated)</label>
                          <input
                            type="text"
                            value={newGroupValues}
                            onChange={e => setNewGroupValues(e.target.value)}
                            placeholder="e.g. Red, Black, Yellow"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-855 bg-neutral-900 text-xs text-neutral-202 outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleAddMatrixGroup}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[10px] text-neutral-300 font-bold transition-all"
                        >
                          <Plus className="h-3 w-3" />
                          {language === 'en' ? 'Add Group' : 'গ্রুপ যোগ করুন'}
                        </button>
                      </div>
                    </div>

                    {/* Active Matrix Groups */}
                    {matrixGroups.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9.5px] uppercase font-bold text-neutral-500 tracking-wider">Configure Groups:</span>
                        <div className="flex flex-wrap gap-2">
                          {matrixGroups.map((group, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-900 text-[10.5px]">
                              <span className="font-bold text-neutral-300">{group.name}:</span>
                              <span className="text-neutral-450 font-mono text-[9.5px]">{group.values.join(', ')}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveMatrixGroup(idx)}
                                className="p-0.5 text-rose-500 hover:bg-rose-955/20 rounded transition-all ml-1.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-end pt-2 border-t border-neutral-900">
                          <button
                            type="button"
                            onClick={handleGenerateMatrix}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all shadow-md"
                          >
                            {language === 'en' ? 'Generate Combinations' : 'কম্বিনেশন জেনারেট করুন'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Added Variants Preview list */}
                {addVariants.length > 0 && (
                  <div className="border-t border-neutral-900 pt-3 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Added Variants:</span>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {addVariants.map((v, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-neutral-950/80 border border-neutral-900 text-[11px]">
                          <div className="flex items-center gap-2">
                            {v.imageUrl && (
                              <div className="relative w-6 h-6 rounded overflow-hidden border border-neutral-800 shrink-0">
                                <Image src={v.imageUrl} alt={v.name} fill className="object-cover" unoptimized />
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-neutral-200">{v.name}</span>
                              {v.attributes && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {Object.entries(v.attributes).map(([key, val]) => {
                                    const lowerName = v.name.toLowerCase();
                                    if (lowerName.includes(key.toLowerCase()) && lowerName.includes(val.toLowerCase())) {
                                      return null;
                                    }
                                    return (
                                      <span key={key} className="text-[7.5px] font-semibold bg-neutral-900 border border-neutral-800 text-neutral-500 px-1 py-0.2 rounded">
                                        {key}: {val}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {v.barcode && <span className="text-[9px] text-neutral-600 ml-2 font-mono">BC: {v.barcode}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantItem(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-955/20 rounded transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-450">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-450 hover:text-neutral-255 transition-colors"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all disabled:opacity-60"
                >
                  {submitting ? (language === 'en' ? 'Saving...' : 'সেভ হচ্ছে...') : (language === 'en' ? 'Save Product' : 'পণ্য সেভ করুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PRODUCT & VARIATION MODAL ───────────────────────── */}
      {showEditModal && editProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.65)' }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden my-4">
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Edit className="h-4 w-4 text-amber-400" />
                </div>
                <h2 className="text-sm font-bold text-neutral-100">
                  {language === 'en' ? 'Edit Product & Variants' : 'পণ্য ও ভেরিয়েশন এডিট করুন'}
                </h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-200 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditProductSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              
              {/* Product Cover Image */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  {language === 'en' ? 'Product Image' : 'পণ্যের ছবি'}
                </label>
                {editImageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-neutral-850 bg-neutral-900 h-28 group">
                    <Image src={editImageUrl} alt="Preview" fill className="object-contain p-2" unoptimized />
                    <button
                      type="button"
                      onClick={() => setEditImageUrl(null)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-900/80 border border-rose-700 text-rose-300 hover:bg-rose-800 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => editFileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 p-4 cursor-pointer hover:border-neutral-600 transition-colors"
                  >
                    <ImagePlus className="h-5 w-5 text-neutral-550" />
                    <span className="text-[10px] text-neutral-500">
                      {language === 'en' ? 'Click to change image' : 'ছবি পরিবর্তন করতে ক্লিক করুন'}
                    </span>
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  {language === 'en' ? 'Product Name *' : 'পণ্যের নাম *'}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors font-semibold"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  {language === 'en' ? 'Category *' : 'ক্যাটাগরি *'}
                </label>
                <input
                  type="text"
                  required
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  {language === 'en' ? 'Product Description' : 'পণ্যের বিবরণ'}
                </label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Unit of Measurement */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                  {language === 'en' ? 'Unit of Measurement (Sales Unit)' : 'বিক্রয় একক (Unit)'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNIT_OPTIONS.map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, unit: u })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        editForm.unit === u
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-500">
                  {editForm.unit === 'গজ' || editForm.unit === 'ফুট' || editForm.unit === 'মিটার' || editForm.unit === 'কেজি'
                    ? '⚠️ এই একক-এ দশমিক পরিমাণ (যেমন ৫.৫) অর্ডার করা যাবে।'
                    : 'এই একক-এ শুধু পূর্ণসংখ্যা (১, ২, ৩...) অর্ডার করা যাবে।'}
                </p>
              </div>

              {/* If no variations, allow editing general alerts/barcode */}
              {(!editProduct.variants || editProduct.variants.length === 0) && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      {language === 'en' ? 'Min Stock Alert' : 'সর্বনিম্ন স্টক এলার্ট'}
                    </label>
                    <input
                      type="number"
                      value={editForm.minStockAlert}
                      onChange={e => setEditForm({ ...editForm, minStockAlert: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      {language === 'en' ? 'Retail Price (৳)' : 'খুচরা বিক্রয় মূল্য (৳)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={editForm.retailPrice || ''}
                      onChange={e => setEditForm({ ...editForm, retailPrice: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                      {language === 'en' ? 'Barcode' : 'বারকোড'}
                    </label>
                    <input
                      type="text"
                      value={editForm.barcode}
                      onChange={e => setEditForm({ ...editForm, barcode: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 text-xs text-neutral-202 outline-none focus:border-amber-500 transition-colors font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Edit Product Variations list section */}
              <div className="border-t border-neutral-900 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300">
                    {language === 'en' ? 'Product Variations' : 'পণ্যের ভেরিয়েশনসমূহ'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineAddVariantForm(!showInlineAddVariantForm);
                      setNewVariantAttrKey('');
                      setNewVariantAttrVal('');
                      setNewVariantBarcode('');
                      setNewVariantRetailPrice('');
                      setNewVariantStock('');
                    }}
                    className="flex items-center gap-1 text-[10px] text-amber-500 hover:text-amber-400 font-semibold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {language === 'en' ? 'Add Variant' : 'নতুন ভেরিয়েশন'}
                  </button>
                </div>

                {showInlineAddVariantForm && (
                  <div className="p-3.5 rounded-xl border border-neutral-850 bg-neutral-955 text-xs space-y-4 animate-fade-in">
                    {/* Tab selector */}
                    <div className="flex border-b border-neutral-900 select-none">
                      <button
                        type="button"
                        onClick={() => setEditVariantTab('MANUAL')}
                        className={`flex-1 pb-2 text-[9px] font-bold text-center border-b-2 transition-all uppercase tracking-wider cursor-pointer ${
                          editVariantTab === 'MANUAL' 
                            ? 'border-amber-500 text-amber-500' 
                            : 'border-transparent text-neutral-500 hover:text-neutral-350'
                        }`}
                      >
                        {language === 'en' ? 'Manual Addition' : 'ম্যানুয়াল মোড'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditVariantTab('MATRIX')}
                        className={`flex-1 pb-2 text-[9px] font-bold text-center border-b-2 transition-all uppercase tracking-wider cursor-pointer ${
                          editVariantTab === 'MATRIX' 
                            ? 'border-amber-500 text-amber-500' 
                            : 'border-transparent text-neutral-500 hover:text-neutral-350'
                        }`}
                      >
                        {language === 'en' ? 'Attribute Matrix' : 'অ্যাট্রিবিউট ম্যাট্রিক্স মোড'}
                      </button>
                    </div>

                    {editVariantTab === 'MANUAL' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">
                              {language === 'en' ? 'Attribute Name' : 'অ্যাট্রিবিউট নাম'}
                            </label>
                            <input
                              type="text"
                              value={newVariantAttrKey}
                              onChange={e => setNewVariantAttrKey(e.target.value)}
                              placeholder="e.g. Brand, Size"
                              className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">
                              {language === 'en' ? 'Value *' : 'মান (Value) *'}
                            </label>
                            <input
                              type="text"
                              value={newVariantAttrVal}
                              onChange={e => setNewVariantAttrVal(e.target.value)}
                              placeholder="e.g. BBS, 9W"
                              className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">
                              {language === 'en' ? 'Retail Price (৳)' : 'খুচরা মূল্য (৳)'}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={newVariantRetailPrice}
                              onChange={e => setNewVariantRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">
                              {language === 'en' ? 'Initial Stock' : 'স্টক (Quantity)'}
                            </label>
                            <input
                              type="number"
                              value={newVariantStock}
                              onChange={e => setNewVariantStock(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">
                              {language === 'en' ? 'Barcode' : 'বারকোড'}
                            </label>
                            <input
                              type="text"
                              value={newVariantBarcode}
                              onChange={e => setNewVariantBarcode(e.target.value)}
                              placeholder={language === 'en' ? 'Optional' : 'ঐচ্ছিক'}
                              className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowInlineAddVariantForm(false)}
                            className="px-2.5 py-1 rounded bg-neutral-900 text-[10px] text-neutral-450 hover:text-neutral-255 cursor-pointer"
                          >
                            {language === 'en' ? 'Cancel' : 'বাতিল'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveInlineAddVariant}
                            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold cursor-pointer"
                          >
                            {language === 'en' ? 'Add' : 'যোগ করুন'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg border border-neutral-900 bg-neutral-955 space-y-3">
                          <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-wide">
                            {language === 'en' ? 'Add Attribute Group' : 'অ্যাট্রিবিউট গ্রুপ যোগ করুন'}
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">Group (e.g. Size, Color)</label>
                              <input
                                type="text"
                                value={editNewGroupName}
                                onChange={e => setEditNewGroupName(e.target.value)}
                                placeholder="e.g. Size"
                                className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">Values (Comma-separated)</label>
                              <input
                                type="text"
                                value={editNewGroupValues}
                                onChange={e => setEditNewGroupValues(e.target.value)}
                                placeholder="e.g. Red, Black, Yellow"
                                className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={handleEditAddMatrixGroup}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[10px] text-neutral-300 font-bold transition-all cursor-pointer"
                            >
                              <Plus className="h-3 w-3" />
                              {language === 'en' ? 'Add Group' : 'গ্রুপ যোগ করুন'}
                            </button>
                          </div>
                        </div>

                        {/* Active Matrix Groups */}
                        {editMatrixGroups.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Configure Groups:</span>
                            <div className="flex flex-wrap gap-2">
                              {editMatrixGroups.map((group, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-900 text-[10px]">
                                  <span className="font-bold text-neutral-300">{group.name}:</span>
                                  <span className="text-neutral-450 font-mono text-[9px]">{group.values.join(', ')}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleEditRemoveMatrixGroup(idx)}
                                    className="p-0.5 text-rose-500 hover:bg-rose-955/20 rounded transition-all ml-1.5 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end pt-2 border-t border-neutral-900">
                              <button
                                type="button"
                                onClick={handleEditGenerateMatrix}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black transition-all shadow-md cursor-pointer"
                              >
                                {language === 'en' ? 'Generate Combinations' : 'কম্বিনেশন জেনারেট করুন'}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Generated Combinations Preview List */}
                        {editMatrixVariants.length > 0 && (
                          <div className="space-y-2 border-t border-neutral-900 pt-3">
                            <span className="text-[9.5px] uppercase font-bold text-neutral-500 tracking-wider">Generated Combinations Preview:</span>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {editMatrixVariants.map((v, idx) => (
                                <div key={idx} className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-850 space-y-2">
                                  <div className="font-bold text-[11px] text-neutral-300">{v.name}</div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">Retail Price</label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={v.retailPrice || ''}
                                        placeholder="0.00"
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          setEditMatrixVariants(prev => prev.map((item, i) => i === idx ? { ...item, retailPrice: val } : item));
                                        }}
                                        className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-200 outline-none focus:border-amber-500 font-mono font-semibold"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">Initial Stock</label>
                                      <input
                                        type="number"
                                        value={v.currentStock || ''}
                                        placeholder="0"
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value) || 0;
                                          setEditMatrixVariants(prev => prev.map((item, i) => i === idx ? { ...item, currentStock: val } : item));
                                        }}
                                        className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-200 outline-none focus:border-amber-500 font-mono font-semibold"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[8px] uppercase tracking-wider text-neutral-500 font-bold block">Barcode</label>
                                      <input
                                        type="text"
                                        value={v.barcode || ''}
                                        placeholder="Optional"
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEditMatrixVariants(prev => prev.map((item, i) => i === idx ? { ...item, barcode: val } : item));
                                        }}
                                        className="w-full px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-200 outline-none focus:border-amber-500 font-mono"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-900">
                              <button
                                type="button"
                                onClick={() => setEditMatrixVariants([])}
                                className="px-3 py-1.5 rounded-lg border border-neutral-850 text-[10px] text-neutral-450 hover:text-neutral-250 cursor-pointer"
                              >
                                {language === 'en' ? 'Clear' : 'মুছে ফেলুন'}
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveInlineMatrixVariants}
                                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold transition-all cursor-pointer"
                              >
                                {language === 'en' ? `Save ${editMatrixVariants.length} Variations` : `${editMatrixVariants.length}টি ভেরিয়েশন সংরক্ষণ করুন`}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {editProduct.variants && editProduct.variants.length > 0 ? (
                  <div className="space-y-2">
                    {editProduct.variants.map((v) => {
                      const isEditingThis = editingVariantId === v.id;
                      const isDeletingThis = deletingVariantId === v.id;

                      return (
                        <div key={v.id} className="p-3 rounded-xl border border-neutral-900 bg-neutral-955 text-xs transition-all">
                          {isEditingThis ? (
                            <div className="space-y-2.5">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">Attribute Name</label>
                                  <input
                                    type="text"
                                    value={editingVariantAttrKey}
                                    onChange={e => setEditingVariantAttrKey(e.target.value)}
                                    placeholder="e.g. Brand, Size"
                                    className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-semibold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">Value *</label>
                                  <input
                                    type="text"
                                    value={editingVariantAttrVal}
                                    onChange={e => setEditingVariantAttrVal(e.target.value)}
                                    placeholder="e.g. BBS, 9W"
                                    className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-semibold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">Retail Price (৳)</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={editingVariantRetailPrice}
                                    onChange={e => setEditingVariantRetailPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                    className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono font-semibold"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] uppercase tracking-wider text-neutral-500 font-bold block">Barcode</label>
                                  <input
                                    type="text"
                                    value={editingVariantBarcode}
                                    onChange={e => setEditingVariantBarcode(e.target.value)}
                                    className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-neutral-805 text-xs text-neutral-202 outline-none focus:border-amber-500 font-mono"
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingVariantId(null)}
                                  className="px-2.5 py-1 rounded bg-neutral-900 text-[10px] text-neutral-400 hover:text-neutral-200"
                                >
                                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineVariantEdit(v.id!)}
                                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold"
                                >
                                  {language === 'en' ? 'Save' : 'সংরক্ষণ'}
                                </button>
                              </div>
                            </div>
                          ) : isDeletingThis ? (
                            <div className="flex items-center justify-between py-1">
                              <span className="text-rose-400 font-semibold text-[11px]">
                                {language === 'en' ? 'Delete this variant?' : 'ডিলিট করতে চান?'}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDeletingVariantId(null)}
                                  className="px-2.5 py-1 rounded bg-neutral-900 text-[10px] text-neutral-400 hover:text-neutral-200"
                                >
                                  {language === 'en' ? 'No' : 'না'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteVariantItemConfirm(v.id!)}
                                  className="px-2.5 py-1 rounded bg-rose-900 hover:bg-rose-800 text-rose-100 text-[10px] font-bold"
                                >
                                  {language === 'en' ? 'Yes, Delete' : 'হ্যাঁ'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-bold text-neutral-200 flex items-center gap-1.5 flex-wrap">
                                  {v.name}
                                  {v.attributes && Object.entries(v.attributes).map(([key, val]) => {
                                    const lowerName = v.name.toLowerCase();
                                    if (lowerName.includes(key.toLowerCase()) && lowerName.includes(val.toLowerCase())) {
                                      return null;
                                    }
                                    return (
                                      <span key={key} className="text-[7.5px] font-extrabold bg-neutral-900 border border-neutral-800 text-neutral-450 px-1 py-0.5 rounded tracking-wide">
                                        {key}: {val}
                                      </span>
                                    );
                                  })}
                                </div>
                                <div className="text-[10px] text-neutral-500 flex gap-2.5 mt-0.5 font-mono">
                                  <span>Stock: {v.currentStock ?? 0}</span>
                                  <span>Avg Cost: ৳{v.movingAverageCost?.toFixed(2) ?? '0.00'}</span>
                                  <span>Retail: ৳{(v.retailPrice || 0).toFixed(2)}</span>
                                  {v.barcode && <span>Barcode: {v.barcode}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstKey = v.attributes ? Object.keys(v.attributes)[0] : 'Option';
                                    const firstVal = v.attributes ? v.attributes[firstKey] : v.name;
                                    setEditingVariantId(v.id!);
                                    setEditingVariantAttrKey(firstKey);
                                    setEditingVariantAttrVal(firstVal);
                                    setEditingVariantBarcode(v.barcode || '');
                                    setEditingVariantRetailPrice(v.retailPrice || '');
                                  }}
                                  className="p-1 rounded text-neutral-450 hover:text-neutral-200 hover:bg-neutral-850 animate-fade-in"
                                  title="Edit variant info"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingVariantId(v.id!)}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-955/20 transition-colors"
                                  title="Delete variant"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-600 italic">
                    {language === 'en' ? 'This product has no variations.' : 'এই পণ্যটির কোনো ভেরিয়েশন নেই।'}
                  </p>
                )}
              </div>

              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-800/60 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-455">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteProduct(editProduct.id)}
                  className="px-4 py-2.5 rounded-xl border border-rose-900 bg-rose-950/20 text-xs font-semibold text-rose-455 hover:bg-rose-900/30 transition-colors"
                  title="Delete Product completely"
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-800 text-xs font-semibold text-neutral-450 hover:text-neutral-250 transition-colors"
                >
                  {language === 'en' ? 'Cancel' : 'বাতিল'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all disabled:opacity-60"
                >
                  {submitting ? (language === 'en' ? 'Saving...' : 'সেভ হচ্ছে...') : (language === 'en' ? 'Save Changes' : 'পরিবর্তন সংরক্ষণ করুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
