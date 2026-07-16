import fs from 'fs';
import path from 'path';
import { type UserPermissions } from './schema';

const FILE_PATH = path.join(process.cwd(), 'data.json');

export interface Product {
  id: number;
  name: string;
  category: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  retailPrice?: number;
  barcode?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  // Unit of Measurement: পিছ | গজ | ফুট | মিটার | কয়েল | কেজি
  unit?: string;
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  currentStock: number;
  minStockAlert: number;
  movingAverageCost: number;
  retailPrice?: number;
  barcode?: string | null;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
}

export interface Invoice {
  id: number;
  invoiceType: 'SALES' | 'PURCHASE';
  manualInvoiceNo: string;
  invoiceDate: string; // YYYY-MM-DD
  partyName: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  expectedPaymentDate?: string | null;
  createdBy?: string | null;
  partyId?: number | null;
  vatRate?: number;
  vatAmount?: number;
  discountAmount?: number;
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  variantId?: number | null;
  quantity: number;
  unitPrice: number;
  costPriceAtSale: number;
}

export interface Expense {
  id: number;
  title: string;
  category: 'Rent' | 'Utility' | 'Salary' | 'Tea-Snacks' | 'Others';
  amount: number;
  date: string; // YYYY-MM-DD
  createdBy?: string | null;
}

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: 'OWNER' | 'STAFF';
  name: string;
  permissions?: UserPermissions | null;
}

export interface Party {
  id: number;
  name: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  phone?: string | null;
  address?: string | null;
  currentBalance: number;
}

export interface Return {
  id: number;
  invoiceId: number;
  returnDate: string; // YYYY-MM-DD
  productId: number;
  quantity: number;
  refundAmount: number;
  reason?: string | null;
  createdBy?: string | null;
}

export interface AuditLog {
  id: number;
  username: string;
  action: string;
  details?: string | null;
  timestamp: string; // ISO String
}

export interface OnlineOrder {
  id: number;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  orderDate: string; // YYYY-MM-DD
  status: 'PENDING' | 'APPROVED' | 'CANCELLED';
  totalAmount: number;
  items: any[];
  customerId?: number | null;
}

export interface Customer {
  id: number;
  phone: string;
  name: string;
  address?: string | null;
  passwordHash: string;
}

export interface LocalDbData {
  products: Product[];
  productVariants: ProductVariant[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  expenses: Expense[];
  users: User[];
  parties: Party[];
  returns: Return[];
  auditLogs: AuditLog[];
  onlineOrders?: OnlineOrder[];
  customers?: Customer[];
}

const DEFAULT_DATA: LocalDbData = {
  onlineOrders: [],
  customers: [],
  products: [
    { id: 1, name: 'LED Bulb Havells', category: 'Lighting', currentStock: 0, minStockAlert: 0, movingAverageCost: 0, barcode: null },
    { id: 2, name: 'Polycab Wire', category: 'Cables', currentStock: 0, minStockAlert: 0, movingAverageCost: 0, barcode: null },
    { id: 3, name: 'Piano Switch Anchor', category: 'Switches', currentStock: 150, minStockAlert: 50, movingAverageCost: 18.00, barcode: '8901234567893' },
    { id: 4, name: 'Socket 5-Pin Anchor', category: 'Switches', currentStock: 80, minStockAlert: 30, movingAverageCost: 35.00, barcode: '8901234567894' },
    { id: 5, name: 'Orient Ceiling Fan', category: 'Fans', currentStock: 0, minStockAlert: 0, movingAverageCost: 0, barcode: null },
    { id: 6, name: 'PVC Electrical Tape Black', category: 'Accessories', currentStock: 0, minStockAlert: 10, movingAverageCost: 12.00, barcode: '8901234567896' },
  ],
  productVariants: [
    { id: 1, productId: 1, name: '9W', currentStock: 45, minStockAlert: 15, movingAverageCost: 120.00, barcode: '8901234567891', imageUrl: null },
    { id: 2, productId: 1, name: '12W', currentStock: 30, minStockAlert: 10, movingAverageCost: 150.00, barcode: null, imageUrl: null },
    { id: 3, productId: 2, name: '1.5 sqmm (90m)', currentStock: 12, minStockAlert: 5, movingAverageCost: 1850.00, barcode: '8901234567892', imageUrl: null },
    { id: 4, productId: 2, name: '2.5 sqmm (90m)', currentStock: 8, minStockAlert: 3, movingAverageCost: 2800.00, barcode: null, imageUrl: null },
    { id: 5, productId: 5, name: '48 inch', currentStock: 5, minStockAlert: 2, movingAverageCost: 2400.00, barcode: '8901234567895', imageUrl: null },
    { id: 6, productId: 5, name: '56 inch', currentStock: 3, minStockAlert: 2, movingAverageCost: 3200.00, barcode: null, imageUrl: null },
  ],
  invoices: [
    { id: 1, invoiceType: 'PURCHASE', manualInvoiceNo: 'P-901', invoiceDate: '2026-06-15', partyName: 'Polycab Distributors Ltd.', totalAmount: 22200.00, paidAmount: 20000.00, dueAmount: 2200.00, expectedPaymentDate: null, createdBy: 'owner', partyId: 1 },
    { id: 2, invoiceType: 'SALES', manualInvoiceNo: 'S-451', invoiceDate: '2026-06-16', partyName: 'Kabir Rahman', totalAmount: 4800.00, paidAmount: 3000.00, dueAmount: 1800.00, expectedPaymentDate: '2026-06-20', createdBy: 'owner', partyId: 2 },
    { id: 3, invoiceType: 'SALES', manualInvoiceNo: 'S-452', invoiceDate: '2026-06-18', partyName: 'Mizanur Rahman', totalAmount: 1850.00, paidAmount: 1850.00, dueAmount: 0.00, expectedPaymentDate: null, createdBy: 'staff', partyId: 3 }
  ],
  invoiceItems: [
    { id: 1, invoiceId: 1, productId: 2, variantId: 3, quantity: 12, unitPrice: 1850.00, costPriceAtSale: 0.00 },
    { id: 2, invoiceId: 2, productId: 5, variantId: 5, quantity: 2, unitPrice: 2400.00, costPriceAtSale: 2400.00 },
    { id: 3, invoiceId: 3, productId: 2, variantId: 3, quantity: 1, unitPrice: 1850.00, costPriceAtSale: 1850.00 }
  ],
  expenses: [
    { id: 1, title: 'Shop Rent June 2026', category: 'Rent', amount: 8000.00, date: '2026-06-01', createdBy: 'owner' },
    { id: 2, title: 'Electricity Bill', category: 'Utility', amount: 2450.00, date: '2026-06-10', createdBy: 'owner' },
    { id: 3, title: 'Evening Snacks & Tea', category: 'Tea-Snacks', amount: 350.00, date: '2026-06-15', createdBy: 'staff' }
  ],
  users: [
    { 
      id: 1, 
      username: 'owner', 
      passwordHash: 'owner123', 
      role: 'OWNER', 
      name: 'Al-Haj Rafiqul Islam',
      permissions: {
        allowSales: true,
        allowPurchases: true,
        allowReports: true,
        allowDelete: true,
        allowStockEdit: true
      }
    },
    { 
      id: 2, 
      username: 'staff', 
      passwordHash: 'staff123', 
      role: 'STAFF', 
      name: 'Md. Karim',
      permissions: {
        allowSales: true,
        allowPurchases: true,
        allowReports: false,
        allowDelete: false,
        allowStockEdit: false
      }
    }
  ],
  parties: [
    { id: 1, name: 'Polycab Distributors Ltd.', partyType: 'SUPPLIER', phone: '01711122233', address: 'Nawabpur, Dhaka', currentBalance: -2200.00 }, // Neg balance means we owe supplier
    { id: 2, name: 'Kabir Rahman', partyType: 'CUSTOMER', phone: '01822233344', address: 'Mirpur-10, Dhaka', currentBalance: 1800.00 }, // Pos balance means customer owes us
    { id: 3, name: 'Mizanur Rahman', partyType: 'CUSTOMER', phone: '01933344455', address: 'Dhanmondi, Dhaka', currentBalance: 0.00 }
  ],
  returns: [],
  auditLogs: [
    { id: 1, username: 'system', action: 'SYSTEM_INIT', details: 'Database initialized successfully', timestamp: '2026-06-21T10:00:00.000Z' }
  ]
};

export function readLocalDb(): LocalDbData {
  if (!fs.existsSync(FILE_PATH)) {
    fs.writeFileSync(FILE_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
    return DEFAULT_DATA;
  }
  try {
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Ensure all tables exist on read (upgrade path)
    let dirty = false;
    if (!parsed.users) { parsed.users = DEFAULT_DATA.users; dirty = true; }
    if (!parsed.parties) { parsed.parties = DEFAULT_DATA.parties; dirty = true; }
    if (!parsed.returns) { parsed.returns = DEFAULT_DATA.returns; dirty = true; }
    if (!parsed.auditLogs) { parsed.auditLogs = DEFAULT_DATA.auditLogs; dirty = true; }
    if (!parsed.productVariants) { parsed.productVariants = []; dirty = true; }
    if (!parsed.onlineOrders) { parsed.onlineOrders = []; dirty = true; }
    if (!parsed.customers) { parsed.customers = []; dirty = true; }
    
    // Ensure all users have permissions property
    parsed.users.forEach((u: any) => {
      if (u.permissions === undefined) {
        u.permissions = {
          allowSales: true,
          allowPurchases: true,
          allowReports: u.role === 'OWNER',
          allowDelete: u.role === 'OWNER',
          allowStockEdit: u.role === 'OWNER'
        };
        dirty = true;
      }
    });
    
    // Ensure products have barcodes
    parsed.products.forEach((p: any) => {
      if (p.barcode === undefined) {
        const found = DEFAULT_DATA.products.find(dp => dp.id === p.id);
        p.barcode = found ? found.barcode : null;
        dirty = true;
      }
    });

    // Ensure invoices have vatRate and vatAmount properties
    if (parsed.invoices) {
      parsed.invoices.forEach((i: any) => {
        if (i.vatRate === undefined) {
          i.vatRate = 0;
          dirty = true;
        }
        if (i.vatAmount === undefined) {
          i.vatAmount = 0;
          dirty = true;
        }
      });
    }

    if (dirty) {
      writeLocalDb(parsed);
    }

    return parsed;
  } catch (err) {
    console.error('Error reading local JSON database, returning defaults:', err);
    return DEFAULT_DATA;
  }
}

export function writeLocalDb(data: LocalDbData): void {
  try {
    fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing to local JSON database:', err);
  }
}
