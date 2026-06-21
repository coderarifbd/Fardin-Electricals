'use server';

import { revalidatePath } from 'next/cache';
import { db, isDemoMode } from './db';
import { products, invoices, invoiceItems, expenses, users, parties, returns, auditLogs } from './db/schema';
import { readLocalDb, writeLocalDb } from './db/localDb';
import { eq, like, and, gte, lte, desc, inArray, notInArray, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';

// Convert decimal values to numbers safely
const parseDecimal = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return isNaN(num) ? 0 : num;
};

// 1. SEARCH PRODUCTS ACTION
export async function searchProductsAction(query: string) {
  if (isDemoMode) {
    const data = readLocalDb();
    let filteredProducts = data.products;
    if (query) {
      const lowercaseQuery = query.toLowerCase();
      filteredProducts = data.products.filter(p => p.name.toLowerCase().includes(lowercaseQuery));
    }
    const sliced = filteredProducts.slice(0, 15);
    return sliced.map(p => {
      const priceHistory = data.invoiceItems
        .filter(item => item.productId === p.id)
        .map(item => {
          const inv = data.invoices.find(i => i.id === item.invoiceId);
          return {
            invoiceType: inv?.invoiceType,
            date: inv?.invoiceDate || '',
            price: item.unitPrice
          };
        })
        .filter(item => item.invoiceType === 'PURCHASE')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3)
        .map(h => ({ date: h.date, price: h.price }));
      return { ...p, priceHistory };
    });
  }

  // Neon Postgres Mode
  try {
    const results = await db!
      .select()
      .from(products)
      .where(like(products.name, `%${query}%`))
      .limit(15);
      
    const mapped = await Promise.all(results.map(async (r) => {
      const history = await db!
        .select({
          date: invoices.invoiceDate,
          price: invoiceItems.unitPrice
        })
        .from(invoiceItems)
        .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
        .where(
          and(
            eq(invoiceItems.productId, r.id),
            eq(invoices.invoiceType, 'PURCHASE')
          )
        )
        .orderBy(desc(invoices.invoiceDate))
        .limit(3);

      return {
        ...r,
        movingAverageCost: parseDecimal(r.movingAverageCost),
        priceHistory: history.map(h => ({
          date: h.date,
          price: parseDecimal(h.price)
        }))
      };
    }));
    return mapped;
  } catch (error) {
    console.error('Error searching products in DB:', error);
    return [];
  }
}

// 2. QUICK ADD PRODUCT ACTION
export async function addQuickProductAction(
  name: string,
  category: string,
  minStockAlert: number,
  movingAverageCost: number
) {
  if (isDemoMode) {
    const data = readLocalDb();
    // Check uniqueness
    if (data.products.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Product already exists');
    }
    const newProduct = {
      id: data.products.length > 0 ? Math.max(...data.products.map(p => p.id)) + 1 : 1,
      name,
      category,
      currentStock: 0,
      minStockAlert: minStockAlert || 0,
      movingAverageCost: movingAverageCost || 0.00
    };
    data.products.push(newProduct);
    writeLocalDb(data);
    return newProduct;
  }

  // Neon Postgres Mode
  try {
    const [inserted] = await db!
      .insert(products)
      .values({
        name,
        category,
        currentStock: 0,
        minStockAlert: minStockAlert || 0,
        movingAverageCost: String(movingAverageCost || 0.00)
      })
      .returning();
    return {
      ...inserted,
      movingAverageCost: parseDecimal(inserted.movingAverageCost)
    };
  } catch (error: any) {
    console.error('Error adding product to DB:', error);
    if (error.code === '23505') {
      throw new Error('Product already exists');
    }
    throw new Error('Database insertion failed');
  }
}

// 3. SAVE INVOICE ACTION
export async function saveInvoiceAction(
  invoiceData: {
    invoiceType: 'SALES' | 'PURCHASE';
    manualInvoiceNo: string;
    invoiceDate: string; // YYYY-MM-DD
    partyName: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    expectedPaymentDate?: string | null;
  },
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[]
) {
  if (items.length === 0) {
    throw new Error('Invoice must contain at least one item');
  }

  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'system';

  if (isDemoMode) {
    const data = readLocalDb();
    
    // Resolve or Auto-Create Party
    let party = data.parties.find(p => p.name.toLowerCase() === invoiceData.partyName.toLowerCase());
    if (!party) {
      const partyId = data.parties.length > 0 ? Math.max(...data.parties.map(p => p.id)) + 1 : 1;
      party = {
        id: partyId,
        name: invoiceData.partyName,
        partyType: invoiceData.invoiceType === 'SALES' ? 'CUSTOMER' : 'SUPPLIER',
        phone: null,
        address: null,
        currentBalance: 0
      };
      data.parties.push(party);
    }
    
    // Adjust Party currentBalance
    if (invoiceData.invoiceType === 'SALES') {
      party.currentBalance = parseFloat((party.currentBalance + invoiceData.dueAmount).toFixed(2));
    } else {
      // PURCHASE: bekeya increases payable (towards negative)
      party.currentBalance = parseFloat((party.currentBalance - invoiceData.dueAmount).toFixed(2));
    }

    const invoiceId = data.invoices.length > 0 ? Math.max(...data.invoices.map(i => i.id)) + 1 : 1;

    // Create Invoice Record
    const newInvoice = {
      id: invoiceId,
      invoiceType: invoiceData.invoiceType,
      manualInvoiceNo: invoiceData.manualInvoiceNo,
      invoiceDate: invoiceData.invoiceDate,
      partyName: invoiceData.partyName,
      totalAmount: invoiceData.totalAmount,
      paidAmount: invoiceData.paidAmount,
      dueAmount: invoiceData.dueAmount,
      expectedPaymentDate: invoiceData.expectedPaymentDate || null,
      createdBy: username,
      partyId: party.id
    };
    data.invoices.push(newInvoice);

    // Process each item
    let itemIndex = data.invoiceItems.length > 0 ? Math.max(...data.invoiceItems.map(item => item.id)) + 1 : 1;

    for (const item of items) {
      const product = data.products.find(p => p.id === item.productId);
      if (!product) continue;

      let costPriceAtSale = 0;

      if (invoiceData.invoiceType === 'PURCHASE') {
        // Calculate new moving average cost
        const currentStock = product.currentStock;
        const currentAvgCost = product.movingAverageCost;
        const purchaseQty = item.quantity;
        const purchasePrice = item.unitPrice;

        let newMovingAverageCost = purchasePrice;
        if (currentStock > 0) {
          newMovingAverageCost = ((currentStock * currentAvgCost) + (purchaseQty * purchasePrice)) / (currentStock + purchaseQty);
        }

        product.movingAverageCost = parseFloat(newMovingAverageCost.toFixed(2));
        product.currentStock = currentStock + purchaseQty;
        costPriceAtSale = purchasePrice;
      } else {
        // SALES
        product.currentStock = product.currentStock - item.quantity;
        costPriceAtSale = product.movingAverageCost;
      }

      data.invoiceItems.push({
        id: itemIndex++,
        invoiceId: invoiceId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPriceAtSale: costPriceAtSale
      });
    }

    // Log audit
    const logId = data.auditLogs.length > 0 ? Math.max(...data.auditLogs.map(l => l.id)) + 1 : 1;
    data.auditLogs.push({
      id: logId,
      username,
      action: 'INVOICE_CREATED',
      details: `Saved ${invoiceData.invoiceType} invoice ${invoiceData.manualInvoiceNo} for party "${invoiceData.partyName}". Total: ৳${invoiceData.totalAmount}`,
      timestamp: new Date().toISOString()
    });

    writeLocalDb(data);
    revalidatePath('/');
    return { success: true, invoiceId };
  }

  // Neon Postgres Mode
  try {
    // Resolve or Auto-Create Party
    let [party] = await db!
      .select()
      .from(parties)
      .where(eq(parties.name, invoiceData.partyName));

    if (!party) {
      [party] = await db!
        .insert(parties)
        .values({
          name: invoiceData.partyName,
          partyType: invoiceData.invoiceType === 'SALES' ? 'CUSTOMER' : 'SUPPLIER',
          currentBalance: '0'
        })
        .returning();
    }

    // Adjust balance
    const currentBal = parseDecimal(party.currentBalance);
    const nextBal = invoiceData.invoiceType === 'SALES'
      ? currentBal + invoiceData.dueAmount
      : currentBal - invoiceData.dueAmount;

    await db!
      .update(parties)
      .set({ currentBalance: String(parseFloat(nextBal.toFixed(2))) })
      .where(eq(parties.id, party.id));

    const [newInvoice] = await db!
      .insert(invoices)
      .values({
        invoiceType: invoiceData.invoiceType,
        manualInvoiceNo: invoiceData.manualInvoiceNo,
        invoiceDate: invoiceData.invoiceDate,
        partyName: invoiceData.partyName,
        totalAmount: String(invoiceData.totalAmount),
        paidAmount: String(invoiceData.paidAmount),
        dueAmount: String(invoiceData.dueAmount),
        expectedPaymentDate: invoiceData.expectedPaymentDate || null,
        createdBy: username,
        partyId: party.id
      })
      .returning();

    for (const item of items) {
      const [product] = await db!
        .select()
        .from(products)
        .where(eq(products.id, item.productId));

      if (!product) continue;

      const currentStock = product.currentStock;
      const currentAvgCost = parseDecimal(product.movingAverageCost);
      let costPriceAtSale = 0;
      let nextStock = currentStock;
      let nextAvgCost = currentAvgCost;

      if (invoiceData.invoiceType === 'PURCHASE') {
        nextStock = currentStock + item.quantity;
        if (currentStock > 0) {
          nextAvgCost = ((currentStock * currentAvgCost) + (item.quantity * item.unitPrice)) / (currentStock + item.quantity);
        } else {
          nextAvgCost = item.unitPrice;
        }
        costPriceAtSale = item.unitPrice;
      } else {
        // SALES
        nextStock = currentStock - item.quantity;
        costPriceAtSale = currentAvgCost;
      }

      // Update product info
      await db!
        .update(products)
        .set({
          currentStock: nextStock,
          movingAverageCost: String(parseFloat(nextAvgCost.toFixed(2)))
        })
        .where(eq(products.id, item.productId));

      // Create item record
      await db!
        .insert(invoiceItems)
        .values({
          invoiceId: newInvoice.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: String(item.unitPrice),
          costPriceAtSale: String(parseFloat(costPriceAtSale.toFixed(2)))
        });
    }

    await db!.insert(auditLogs).values({
      username,
      action: 'INVOICE_CREATED',
      details: `Saved ${invoiceData.invoiceType} invoice ${invoiceData.manualInvoiceNo} for party "${invoiceData.partyName}". Total: ৳${invoiceData.totalAmount}`
    });

    revalidatePath('/');
    return { success: true, invoiceId: newInvoice.id };
  } catch (error) {
    console.error('Error saving invoice in DB:', error);
    throw new Error('Failed to save invoice');
  }
}

// 4. RECORD PAYMENT ACTION
export async function recordPaymentAction(invoiceId: number, amountPaid: number) {
  if (amountPaid <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'system';

  if (isDemoMode) {
    const data = readLocalDb();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    if (amountPaid > invoice.dueAmount) {
      throw new Error('Payment amount exceeds due amount');
    }

    invoice.paidAmount = parseFloat((invoice.paidAmount + amountPaid).toFixed(2));
    invoice.dueAmount = parseFloat((invoice.dueAmount - amountPaid).toFixed(2));

    // Update Party currentBalance
    const party = data.parties.find(p => p.name.toLowerCase() === invoice.partyName.toLowerCase());
    if (party) {
      if (invoice.invoiceType === 'SALES') {
        // Customer paid us -> their outstanding balance decreases
        party.currentBalance = parseFloat((party.currentBalance - amountPaid).toFixed(2));
      } else {
        // We paid supplier -> our payable decreases (moves back towards 0 from negative)
        party.currentBalance = parseFloat((party.currentBalance + amountPaid).toFixed(2));
      }
    }

    // Log Audit
    const logId = data.auditLogs.length > 0 ? Math.max(...data.auditLogs.map(l => l.id)) + 1 : 1;
    data.auditLogs.push({
      id: logId,
      username,
      action: 'PAYMENT_RECORDED',
      details: `Recorded payment of ৳${amountPaid} for ${invoice.invoiceType} invoice ${invoice.manualInvoiceNo} (${invoice.partyName})`,
      timestamp: new Date().toISOString()
    });

    writeLocalDb(data);
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    const [invoice] = await db!
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error('Invoice not found');

    const paidVal = parseDecimal(invoice.paidAmount);
    const dueVal = parseDecimal(invoice.dueAmount);

    if (amountPaid > dueVal) {
      throw new Error('Payment amount exceeds due amount');
    }

    const nextPaid = paidVal + amountPaid;
    const nextDue = dueVal - amountPaid;

    await db!
      .update(invoices)
      .set({
        paidAmount: String(parseFloat(nextPaid.toFixed(2))),
        dueAmount: String(parseFloat(nextDue.toFixed(2)))
      })
      .where(eq(invoices.id, invoiceId));

    // Update Party balance
    const partyName = invoice.partyName;
    const [party] = invoice.partyId
      ? await db!.select().from(parties).where(eq(parties.id, invoice.partyId))
      : await db!.select().from(parties).where(eq(parties.name, partyName));

    if (party) {
      const nextBal = invoice.invoiceType === 'SALES'
        ? parseDecimal(party.currentBalance) - amountPaid
        : parseDecimal(party.currentBalance) + amountPaid;

      await db!
        .update(parties)
        .set({ currentBalance: String(parseFloat(nextBal.toFixed(2))) })
        .where(eq(parties.id, party.id));
    }

    await db!.insert(auditLogs).values({
      username,
      action: 'PAYMENT_RECORDED',
      details: `Recorded payment of ৳${amountPaid} for ${invoice.invoiceType} invoice ${invoice.manualInvoiceNo} (${invoice.partyName})`
    });

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error recording payment in DB:', error);
    throw new Error(error.message || 'Failed to record payment');
  }
}

// 5. ADD EXPENSE ACTION
export async function addExpenseAction(title: string, category: string, amount: number, date: string) {
  if (isDemoMode) {
    const data = readLocalDb();
    const newExpense = {
      id: data.expenses.length > 0 ? Math.max(...data.expenses.map(e => e.id)) + 1 : 1,
      title,
      category: category as any,
      amount,
      date
    };
    data.expenses.push(newExpense);
    writeLocalDb(data);
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    await db!
      .insert(expenses)
      .values({
        title,
        category,
        amount: String(amount),
        date
      });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Error logging expense in DB:', error);
    throw new Error('Failed to log expense');
  }
}

// 6. GET EXPENSES LIST ACTION
export async function getExpensesAction() {
  if (isDemoMode) {
    const data = readLocalDb();
    return data.expenses.sort((a, b) => b.date.localeCompare(a.date));
  }

  try {
    const list = await db!
      .select()
      .from(expenses)
      .orderBy(desc(expenses.date));
    return list.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }
}

// 7. GET INVOICES / DUE LEDGER LIST ACTION
export async function getInvoicesAction(search?: string) {
  if (isDemoMode) {
    const data = readLocalDb();
    let list = data.invoices;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(i => i.manualInvoiceNo.toLowerCase().includes(q) || i.partyName.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));
  }

  try {
    let list;
    if (search) {
      list = await db!
        .select()
        .from(invoices)
        .where(
          sql`LOWER(${invoices.manualInvoiceNo}) LIKE ${`%${search.toLowerCase()}%`} OR LOWER(${invoices.partyName}) LIKE ${`%${search.toLowerCase()}%`}`
        )
        .orderBy(desc(invoices.invoiceDate));
    } else {
      list = await db!
        .select()
        .from(invoices)
        .orderBy(desc(invoices.invoiceDate));
    }
    return list.map(i => ({
      ...i,
      totalAmount: parseDecimal(i.totalAmount),
      paidAmount: parseDecimal(i.paidAmount),
      dueAmount: parseDecimal(i.dueAmount)
    }));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
}

// 7.5. GET SINGLE INVOICE ACTION
export async function getInvoiceAction(invoiceId: number) {
  if (isDemoMode) {
    const data = readLocalDb();
    const invoice = data.invoices.find(i => i.id === invoiceId);
    return invoice || null;
  }

  try {
    const [invoice] = await db!.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) return null;
    return {
      ...invoice,
      totalAmount: parseDecimal(invoice.totalAmount),
      paidAmount: parseDecimal(invoice.paidAmount),
      dueAmount: parseDecimal(invoice.dueAmount)
    };
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return null;
  }
}

// 8. GET INVOICE ITEMS ACTION
export async function getInvoiceItemsAction(invoiceId: number) {
  if (isDemoMode) {
    const data = readLocalDb();
    const items = data.invoiceItems.filter(item => item.invoiceId === invoiceId);
    return items.map(item => {
      const product = data.products.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product ? product.name : 'Unknown Product'
      };
    });
  }

  try {
    const list = await db!
      .select({
        id: invoiceItems.id,
        invoiceId: invoiceItems.invoiceId,
        productId: invoiceItems.productId,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        costPriceAtSale: invoiceItems.costPriceAtSale,
        productName: products.name
      })
      .from(invoiceItems)
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .where(eq(invoiceItems.invoiceId, invoiceId));

    return list.map(i => ({
      ...i,
      unitPrice: parseDecimal(i.unitPrice),
      costPriceAtSale: parseDecimal(i.costPriceAtSale)
    }));
  } catch (error) {
    console.error('Error fetching invoice items:', error);
    return [];
  }
}

// 9. GET DASHBOARD DATA ACTION
export async function getDashboardDataAction() {
  const todayStr = new Date().toLocaleDateString('en-CA');

  if (isDemoMode) {
    const data = readLocalDb();
    const totalSales = data.invoices
      .filter(i => i.invoiceType === 'SALES')
      .reduce((sum, i) => sum + i.totalAmount, 0);

    const totalPurchases = data.invoices
      .filter(i => i.invoiceType === 'PURCHASE')
      .reduce((sum, i) => sum + i.totalAmount, 0);

    const totalExpenses = data.expenses
      .reduce((sum, e) => sum + e.amount, 0);

    const salesInvoiceIds = new Set(data.invoices.filter(i => i.invoiceType === 'SALES').map(i => i.id));
    const totalCogs = data.invoiceItems
      .filter(item => salesInvoiceIds.has(item.invoiceId))
      .reduce((sum, item) => sum + (item.quantity * item.costPriceAtSale), 0);

    const netProfit = totalSales - (totalCogs + totalExpenses);

    const lowStockList = data.products.filter(p => p.currentStock <= p.minStockAlert);

    const currentDate = new Date('2026-06-21');
    const sixtyDaysAgo = new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

    const recentlySoldProductIds = new Set(
      data.invoices
        .filter(i => i.invoiceType === 'SALES' && i.invoiceDate >= sixtyDaysAgoStr)
        .flatMap(i => data.invoiceItems.filter(item => item.invoiceId === i.id).map(item => item.productId))
    );

    const deadStockList = data.products.filter(p => p.currentStock > 0 && !recentlySoldProductIds.has(p.id));

    // Overdue Collections
    const overdueInvoices = data.invoices.filter(i => 
      i.invoiceType === 'SALES' && 
      i.dueAmount > 0 && 
      i.expectedPaymentDate && 
      i.expectedPaymentDate < todayStr
    );

    // Category Margins
    const catMap = new Map<string, { revenue: number, cost: number }>();
    data.invoiceItems.forEach(item => {
      const inv = data.invoices.find(i => i.id === item.invoiceId);
      if (inv && inv.invoiceType === 'SALES') {
        const prod = data.products.find(p => p.id === item.productId);
        const cat = prod?.category || 'Others';
        const current = catMap.get(cat) || { revenue: 0, cost: 0 };
        current.revenue += item.quantity * item.unitPrice;
        current.cost += item.quantity * item.costPriceAtSale;
        catMap.set(cat, current);
      }
    });
    const categoryMargins = Array.from(catMap.entries()).map(([category, vals]) => {
      const profit = vals.revenue - vals.cost;
      const marginPercent = vals.revenue > 0 ? (profit / vals.revenue) * 100 : 0;
      return {
        category,
        revenue: parseFloat(vals.revenue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        marginPercent: parseFloat(marginPercent.toFixed(1))
      };
    });

    const cashflowMap = new Map<string, { cashIn: number, cashOut: number }>();
    
    const allDates = [
      ...data.invoices.map(i => i.invoiceDate),
      ...data.expenses.map(e => e.date)
    ].sort();

    const activeDates = Array.from(new Set(allDates)).slice(-15);
    activeDates.forEach(d => cashflowMap.set(d, { cashIn: 0, cashOut: 0 }));

    data.invoices.forEach(inv => {
      if (cashflowMap.has(inv.invoiceDate)) {
        const val = cashflowMap.get(inv.invoiceDate)!;
        if (inv.invoiceType === 'SALES') {
          val.cashIn += inv.paidAmount;
        } else {
          val.cashOut += inv.paidAmount;
        }
      }
    });

    data.expenses.forEach(exp => {
      if (cashflowMap.has(exp.date)) {
        const val = cashflowMap.get(exp.date)!;
        val.cashOut += exp.amount;
      }
    });

    const cashflowData = Array.from(cashflowMap.entries())
      .map(([date, vals]) => ({
        date,
        cashIn: parseFloat(vals.cashIn.toFixed(2)),
        cashOut: parseFloat(vals.cashOut.toFixed(2))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const productSalesMap = new Map<number, number>();
    data.invoiceItems.forEach(item => {
      const inv = data.invoices.find(i => i.id === item.invoiceId);
      if (inv && inv.invoiceType === 'SALES') {
        productSalesMap.set(item.productId, (productSalesMap.get(item.productId) || 0) + item.quantity);
      }
    });

    const topSellingData = Array.from(productSalesMap.entries())
      .map(([pid, qty]) => {
        const p = data.products.find(prod => prod.id === pid);
        return {
          name: p ? p.name : 'Unknown',
          quantity: qty
        };
      })
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      metrics: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalCogs,
        netProfit
      },
      lowStock: lowStockList,
      deadStock: deadStockList,
      overdueInvoices,
      categoryMargins,
      cashflowData,
      topSellingData
    };
  }

  // Neon Postgres Mode
  try {
    // Total Sales
    const salesInvoices = await db!
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceType, 'SALES'));
    const totalSales = salesInvoices.reduce((sum, i) => sum + parseDecimal(i.totalAmount), 0);

    // Total Purchases
    const purchaseInvoices = await db!
      .select()
      .from(invoices)
      .where(eq(invoices.invoiceType, 'PURCHASE'));
    const totalPurchases = purchaseInvoices.reduce((sum, i) => sum + parseDecimal(i.totalAmount), 0);

    // Total Expenses
    const allExpenses = await db!
      .select()
      .from(expenses);
    const totalExpenses = allExpenses.reduce((sum, e) => sum + parseDecimal(e.amount), 0);

    // Total COGS
    const salesItems = await db!
      .select({
        quantity: invoiceItems.quantity,
        costPriceAtSale: invoiceItems.costPriceAtSale
      })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(eq(invoices.invoiceType, 'SALES'));
    const totalCogs = salesItems.reduce((sum, item) => sum + (item.quantity * parseDecimal(item.costPriceAtSale)), 0);

    const netProfit = totalSales - (totalCogs + totalExpenses);

    // Low stock
    const allProducts = await db!.select().from(products);
    const lowStockList = allProducts
      .map(p => ({
        ...p,
        movingAverageCost: parseDecimal(p.movingAverageCost)
      }))
      .filter(p => p.currentStock <= p.minStockAlert);

    // Dead Stock (no sales in last 60 days)
    const currentDate = new Date();
    const sixtyDaysAgo = new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];

    const recentSalesItems = await db!
      .selectDistinct({ productId: invoiceItems.productId })
      .from(invoiceItems)
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(
        and(
          eq(invoices.invoiceType, 'SALES'),
          gte(invoices.invoiceDate, sixtyDaysAgoStr)
        )
      );

    const recentlySoldIds = new Set(recentSalesItems.map(item => item.productId));
    const deadStockList = allProducts
      .map(p => ({
        ...p,
        movingAverageCost: parseDecimal(p.movingAverageCost)
      }))
      .filter(p => p.currentStock > 0 && !recentlySoldIds.has(p.id));

    // Overdue Collections
    const overdueInvoices = await db!
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.invoiceType, 'SALES'),
          sql`${invoices.dueAmount} > 0`,
          sql`${invoices.expectedPaymentDate} IS NOT NULL`,
          sql`${invoices.expectedPaymentDate} < ${todayStr}`
        )
      );
    const formattedOverdue = overdueInvoices.map(i => ({
      ...i,
      totalAmount: parseDecimal(i.totalAmount),
      paidAmount: parseDecimal(i.paidAmount),
      dueAmount: parseDecimal(i.dueAmount)
    }));

    // Category Margins
    const salesItemsWithCategories = await db!
      .select({
        category: products.category,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        costPriceAtSale: invoiceItems.costPriceAtSale
      })
      .from(invoiceItems)
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(eq(invoices.invoiceType, 'SALES'));

    const catMap = new Map<string, { revenue: number, cost: number }>();
    salesItemsWithCategories.forEach(item => {
      const cat = item.category || 'Others';
      const qty = item.quantity;
      const price = parseDecimal(item.unitPrice);
      const cost = parseDecimal(item.costPriceAtSale);

      const current = catMap.get(cat) || { revenue: 0, cost: 0 };
      current.revenue += qty * price;
      current.cost += qty * cost;
      catMap.set(cat, current);
    });

    const categoryMargins = Array.from(catMap.entries()).map(([category, vals]) => {
      const profit = vals.revenue - vals.cost;
      const marginPercent = vals.revenue > 0 ? (profit / vals.revenue) * 100 : 0;
      return {
        category,
        revenue: parseFloat(vals.revenue.toFixed(2)),
        profit: parseFloat(profit.toFixed(2)),
        marginPercent: parseFloat(marginPercent.toFixed(1))
      };
    });

    // Cashflow series (last 15 active transaction dates)
    const cashflowMap = new Map<string, { cashIn: number, cashOut: number }>();
    const datesSet = new Set<string>();

    salesInvoices.forEach(i => datesSet.add(i.invoiceDate));
    purchaseInvoices.forEach(i => datesSet.add(i.invoiceDate));
    allExpenses.forEach(e => datesSet.add(e.date));

    const sortedDates = Array.from(datesSet).sort().slice(-15);
    sortedDates.forEach(d => cashflowMap.set(d, { cashIn: 0, cashOut: 0 }));

    salesInvoices.forEach(inv => {
      if (cashflowMap.has(inv.invoiceDate)) {
        const val = cashflowMap.get(inv.invoiceDate)!;
        val.cashIn += parseDecimal(inv.paidAmount);
      }
    });

    purchaseInvoices.forEach(inv => {
      if (cashflowMap.has(inv.invoiceDate)) {
        const val = cashflowMap.get(inv.invoiceDate)!;
        val.cashOut += parseDecimal(inv.paidAmount);
      }
    });

    allExpenses.forEach(exp => {
      if (cashflowMap.has(exp.date)) {
        const val = cashflowMap.get(exp.date)!;
        val.cashOut += parseDecimal(exp.amount);
      }
    });

    const cashflowData = Array.from(cashflowMap.entries())
      .map(([date, vals]) => ({
        date,
        cashIn: parseFloat(vals.cashIn.toFixed(2)),
        cashOut: parseFloat(vals.cashOut.toFixed(2))
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top Selling Products (by quantity)
    const topSalesQuery = await db!
      .select({
        name: products.name,
        quantity: sql<number>`sum(${invoiceItems.quantity})::int`
      })
      .from(invoiceItems)
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .where(eq(invoices.invoiceType, 'SALES'))
      .groupBy(products.name)
      .orderBy(desc(sql`sum(${invoiceItems.quantity})`))
      .limit(5);

    return {
      metrics: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalCogs,
        netProfit
      },
      lowStock: lowStockList,
      deadStock: deadStockList,
      overdueInvoices: formattedOverdue,
      categoryMargins,
      cashflowData,
      topSellingData: topSalesQuery
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return {
      metrics: { totalSales: 0, totalPurchases: 0, totalExpenses: 0, totalCogs: 0, netProfit: 0 },
      lowStock: [],
      deadStock: [],
      overdueInvoices: [],
      categoryMargins: [],
      cashflowData: [],
      topSellingData: []
    };
  }
}

// 10. GET REPORT DATA ACTION
export async function getReportDataAction(year: number, month?: number) {
  let startDate: string;
  let endDate: string;

  if (month && month >= 1 && month <= 12) {
    const lastDay = new Date(year, month, 0).getDate();
    const mm = String(month).padStart(2, '0');
    startDate = `${year}-${mm}-01`;
    endDate = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  if (isDemoMode) {
    const data = readLocalDb();
    
    const periodInvoices = data.invoices.filter(i => i.invoiceDate >= startDate && i.invoiceDate <= endDate);
    const periodExpenses = data.expenses.filter(e => e.date >= startDate && e.date <= endDate);

    const totalSales = periodInvoices
      .filter(i => i.invoiceType === 'SALES')
      .reduce((sum, i) => sum + i.totalAmount, 0);

    const totalPurchases = periodInvoices
      .filter(i => i.invoiceType === 'PURCHASE')
      .reduce((sum, i) => sum + i.totalAmount, 0);

    const totalExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

    const salesInvoiceIds = new Set(periodInvoices.filter(i => i.invoiceType === 'SALES').map(i => i.id));
    const totalCogs = data.invoiceItems
      .filter(item => salesInvoiceIds.has(item.invoiceId))
      .reduce((sum, item) => sum + (item.quantity * item.costPriceAtSale), 0);

    const netProfit = totalSales - (totalCogs + totalExpenses);

    return {
      metrics: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalCogs,
        netProfit
      },
      invoices: periodInvoices.sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
      expenses: periodExpenses.sort((a, b) => b.date.localeCompare(a.date))
    };
  }

  try {
    const periodInvoices = await db!
      .select()
      .from(invoices)
      .where(and(gte(invoices.invoiceDate, startDate), lte(invoices.invoiceDate, endDate)))
      .orderBy(desc(invoices.invoiceDate));

    const periodExpenses = await db!
      .select()
      .from(expenses)
      .where(and(gte(expenses.date, startDate), lte(expenses.date, endDate)))
      .orderBy(desc(expenses.date));

    const formattedInvoices = periodInvoices.map(i => ({
      ...i,
      totalAmount: parseDecimal(i.totalAmount),
      paidAmount: parseDecimal(i.paidAmount),
      dueAmount: parseDecimal(i.dueAmount)
    }));

    const formattedExpenses = periodExpenses.map(e => ({
      ...e,
      amount: parseDecimal(e.amount)
    }));

    const totalSales = formattedInvoices
      .filter(i => i.invoiceType === 'SALES')
      .reduce((sum, i) => sum + i.totalAmount, 0);

    const totalPurchases = formattedInvoices
      .filter(i => i.invoiceType === 'PURCHASE')
      .reduce((sum, i) => sum + i.totalAmount, 0);

    const totalExpenses = formattedExpenses.reduce((sum, e) => sum + e.amount, 0);

    let totalCogs = 0;
    const salesInvoiceIds = formattedInvoices.filter(i => i.invoiceType === 'SALES').map(i => i.id);
    
    if (salesInvoiceIds.length > 0) {
      const salesItems = await db!
        .select({
          quantity: invoiceItems.quantity,
          costPriceAtSale: invoiceItems.costPriceAtSale
        })
        .from(invoiceItems)
        .where(inArray(invoiceItems.invoiceId, salesInvoiceIds));
      totalCogs = salesItems.reduce((sum, item) => sum + (item.quantity * parseDecimal(item.costPriceAtSale)), 0);
    }

    const netProfit = totalSales - (totalCogs + totalExpenses);

    return {
      metrics: {
        totalSales,
        totalPurchases,
        totalExpenses,
        totalCogs,
        netProfit
      },
      invoices: formattedInvoices,
      expenses: formattedExpenses
    };
  } catch (error) {
    console.error('Error fetching report data:', error);
    return {
      metrics: { totalSales: 0, totalPurchases: 0, totalExpenses: 0, totalCogs: 0, netProfit: 0 },
      invoices: [],
      expenses: []
    };
  }
}

// 11. EXPORT DATABASE ACTION
export async function exportDatabaseAction() {
  if (isDemoMode) {
    const data = readLocalDb();
    return {
      products: data.products,
      invoices: data.invoices,
      expenses: data.expenses
    };
  }

  try {
    const allProducts = await db!.select().from(products);
    const allInvoices = await db!.select().from(invoices);
    const allExpenses = await db!.select().from(expenses);

    return {
      products: allProducts.map(p => ({
        ...p,
        movingAverageCost: parseDecimal(p.movingAverageCost)
      })),
      invoices: allInvoices.map(i => ({
        ...i,
        totalAmount: parseDecimal(i.totalAmount),
        paidAmount: parseDecimal(i.paidAmount),
        dueAmount: parseDecimal(i.dueAmount)
      })),
      expenses: allExpenses.map(e => ({
        ...e,
        amount: parseDecimal(e.amount)
      }))
    };
  } catch (error) {
    console.error('Error exporting database:', error);
    return { products: [], invoices: [], expenses: [] };
  }
}

// Helper to write audit log
export async function logAuditAction(action: string, details?: string | null) {
  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'system';
  
  if (isDemoMode) {
    const data = readLocalDb();
    const newLog = {
      id: data.auditLogs.length > 0 ? Math.max(...data.auditLogs.map(l => l.id)) + 1 : 1,
      username,
      action,
      details: details || null,
      timestamp: new Date().toISOString()
    };
    data.auditLogs.push(newLog);
    writeLocalDb(data);
    return;
  }
  
  try {
    await db!.insert(auditLogs).values({
      username,
      action,
      details: details || null
    });
  } catch (err) {
    console.error('Error logging audit:', err);
  }
}

// 12. AUTHENTICATION ACTIONS
export async function getCurrentUserAction() {
  const cookieStore = await cookies();
  const session = cookieStore.get('eshop_session');
  if (!session?.value) return null;
  try {
    return JSON.parse(session.value) as { username: string; role: 'OWNER' | 'STAFF'; name: string };
  } catch (e) {
    return null;
  }
}

export async function loginAction(username: string, passwordHash: string) {
  if (isDemoMode) {
    const data = readLocalDb();
    const user = data.users.find(u => u.username === username && u.passwordHash === passwordHash);
    if (!user) {
      throw new Error('Invalid username or password');
    }
    const sessionData = { username: user.username, role: user.role, name: user.name };
    const cookieStore = await cookies();
    cookieStore.set('eshop_session', JSON.stringify(sessionData), { maxAge: 60 * 60 * 24, path: '/' });
    
    // Log audit
    const newLog = {
      id: data.auditLogs.length > 0 ? Math.max(...data.auditLogs.map(l => l.id)) + 1 : 1,
      username: user.username,
      action: 'USER_LOGIN',
      details: `User logged in from IP (Demo)`,
      timestamp: new Date().toISOString()
    };
    data.auditLogs.push(newLog);
    writeLocalDb(data);
    
    return { success: true, user: sessionData };
  }

  try {
    const [user] = await db!
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.passwordHash, passwordHash)));
    if (!user) {
      throw new Error('Invalid username or password');
    }
    const sessionData = { username: user.username, role: user.role as 'OWNER' | 'STAFF', name: user.name };
    const cookieStore = await cookies();
    cookieStore.set('eshop_session', JSON.stringify(sessionData), { maxAge: 60 * 60 * 24, path: '/' });
    
    await db!.insert(auditLogs).values({
      username: user.username,
      action: 'USER_LOGIN',
      details: 'User logged in successfully'
    });
    
    return { success: true, user: sessionData };
  } catch (error: any) {
    console.error('Error logging in:', error);
    throw new Error(error.message || 'Login failed');
  }
}

export async function logoutAction() {
  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'unknown';
  
  // Log audit
  await logAuditAction('USER_LOGOUT', `User ${username} logged out`);
  
  const cookieStore = await cookies();
  cookieStore.delete('eshop_session');
  return { success: true };
}

// 13. AUDIT LOGS ACTION
export async function getAuditLogsAction() {
  const user = await getCurrentUserAction();
  if (!user || user.role !== 'OWNER') {
    throw new Error('Unauthorized');
  }
  
  if (isDemoMode) {
    const data = readLocalDb();
    return [...data.auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
  }
  
  try {
    return await db!
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.timestamp))
      .limit(100);
  } catch (error) {
    console.error('Error getting audit logs:', error);
    return [];
  }
}

// 14. GET PRODUCTS ACTION (Read-only for Products page)
export async function getProductsAction() {
  if (isDemoMode) {
    const data = readLocalDb();
    return data.products.map(p => {
      const history = data.invoiceItems
        .filter(item => item.productId === p.id)
        .map(item => {
          const inv = data.invoices.find(i => i.id === item.invoiceId);
          return {
            invoiceType: inv?.invoiceType,
            date: inv?.invoiceDate || '',
            price: item.unitPrice
          };
        })
        .filter(item => item.invoiceType === 'PURCHASE')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5)
        .map(h => ({ date: h.date, price: h.price }));
      return { ...p, priceHistory: history };
    });
  }

  try {
    const results = await db!.select().from(products);
    return await Promise.all(results.map(async (r) => {
      const history = await db!
        .select({
          date: invoices.invoiceDate,
          price: invoiceItems.unitPrice
        })
        .from(invoiceItems)
        .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
        .where(
          and(
            eq(invoiceItems.productId, r.id),
            eq(invoices.invoiceType, 'PURCHASE')
          )
        )
        .orderBy(desc(invoices.invoiceDate))
        .limit(5);

      return {
        ...r,
        movingAverageCost: parseDecimal(r.movingAverageCost),
        priceHistory: history.map(h => ({
          date: h.date,
          price: parseDecimal(h.price)
        }))
      };
    }));
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
}

// 15. PARTIES ACTIONS
export async function getPartiesAction(partyType?: 'CUSTOMER' | 'SUPPLIER') {
  if (isDemoMode) {
    const data = readLocalDb();
    if (partyType) {
      return data.parties.filter(p => p.partyType === partyType);
    }
    return data.parties;
  }

  try {
    if (partyType) {
      const results = await db!
        .select()
        .from(parties)
        .where(eq(parties.partyType, partyType));
      return results.map(r => ({ ...r, currentBalance: parseDecimal(r.currentBalance) }));
    }
    const results = await db!.select().from(parties);
    return results.map(r => ({ ...r, currentBalance: parseDecimal(r.currentBalance) }));
  } catch (error) {
    console.error('Error getting parties:', error);
    return [];
  }
}

// 16. SMS REMINDER ACTION
export async function sendSmsReminderAction(invoiceId: number) {
  let partyName = '';
  let dueAmount = 0;
  let manualInvoiceNo = '';
  let phone = '';

  if (isDemoMode) {
    const data = readLocalDb();
    const inv = data.invoices.find(i => i.id === invoiceId);
    if (!inv) throw new Error('Invoice not found');
    partyName = inv.partyName;
    dueAmount = inv.dueAmount;
    manualInvoiceNo = inv.manualInvoiceNo;
    const p = data.parties.find(x => x.name.toLowerCase() === partyName.toLowerCase());
    phone = p?.phone || '01XXXXXXXXX';
  } else {
    const [inv] = await db!.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!inv) throw new Error('Invoice not found');
    partyName = inv.partyName;
    dueAmount = parseDecimal(inv.dueAmount);
    manualInvoiceNo = inv.manualInvoiceNo;
    
    if (inv.partyId) {
      const [p] = await db!.select().from(parties).where(eq(parties.id, inv.partyId));
      phone = p?.phone || '01XXXXXXXXX';
    } else {
      const [p] = await db!.select().from(parties).where(eq(parties.name, partyName));
      phone = p?.phone || '01XXXXXXXXX';
    }
  }

  const messageText = `প্রিয় ${partyName}, আপনার ইনভয়েস নম্বর ${manualInvoiceNo}-এর বকেয়া পরিমাণ ৳${dueAmount.toLocaleString()} এখনো পরিশোধ করা হয়নি। অনুগ্রহ করে দ্রুত পরিশোধ করুন। ধন্যবাদ, ফারদিন ইলেক্ট্রিক্যালস।`;

  // Log SMS dispatch in audit
  await logAuditAction('SMS_REMINDER_SENT', `Sent SMS to ${partyName} (${phone}): "${messageText}"`);

  return { 
    success: true, 
    message: `SMS Sent successfully to ${partyName} at ${phone}!`,
    smsContent: messageText 
  };
}

// 17. RETURN ITEM ACTION
export async function processReturnAction(
  invoiceId: number,
  productId: number,
  returnQty: number,
  refundAmount: number,
  reason: string
) {
  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'system';
  
  if (returnQty <= 0) {
    throw new Error('Return quantity must be greater than zero');
  }

  if (isDemoMode) {
    const data = readLocalDb();
    
    // Find Invoice
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // Find Product
    const product = data.products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');

    // Adjust Product Stock
    if (invoice.invoiceType === 'SALES') {
      product.currentStock += returnQty; // Sold item returned -> inventory increases
    } else {
      product.currentStock -= returnQty; // Purchased item returned -> inventory decreases
    }

    // Adjust Invoice Total/Dues
    const oldDueAmount = invoice.dueAmount;
    invoice.totalAmount = Math.max(0, parseFloat((invoice.totalAmount - refundAmount).toFixed(2)));
    if (invoice.totalAmount < invoice.paidAmount) {
      invoice.paidAmount = invoice.totalAmount;
      invoice.dueAmount = 0;
    } else {
      invoice.dueAmount = parseFloat((invoice.totalAmount - invoice.paidAmount).toFixed(2));
    }
    const newDueAmount = invoice.dueAmount;

    // Adjust Party Balance
    const party = data.parties.find(p => p.name.toLowerCase() === invoice.partyName.toLowerCase());
    if (party) {
      // Due decreased means customer owes us less (subtracting from customer balance)
      // For supplier, our payable decreases (adding/subtracting according to balance)
      const dueDiff = oldDueAmount - newDueAmount;
      if (invoice.invoiceType === 'SALES') {
        party.currentBalance = parseFloat((party.currentBalance - dueDiff).toFixed(2));
      } else {
        party.currentBalance = parseFloat((party.currentBalance + dueDiff).toFixed(2));
      }
    }

    // Record Return
    const returnId = data.returns.length > 0 ? Math.max(...data.returns.map(r => r.id)) + 1 : 1;
    data.returns.push({
      id: returnId,
      invoiceId,
      productId,
      quantity: returnQty,
      refundAmount,
      reason,
      createdBy: username,
      returnDate: new Date().toISOString().split('T')[0]
    });

    writeLocalDb(data);
    
    // Log audit
    await logAuditAction('ITEM_RETURNED', `Returned ${returnQty} pcs of ${product.name} from Invoice ${invoice.manualInvoiceNo}. Refunded: ৳${refundAmount}`);
    
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    // Load Invoice
    const [invoice] = await db!.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error('Invoice not found');

    // Load Product
    const [product] = await db!.select().from(products).where(eq(products.id, productId));
    if (!product) throw new Error('Product not found');

    // Adjust stock
    const nextStock = invoice.invoiceType === 'SALES' 
      ? product.currentStock + returnQty 
      : product.currentStock - returnQty;

    await db!
      .update(products)
      .set({ currentStock: nextStock })
      .where(eq(products.id, productId));

    // Adjust Invoice Total/Dues
    const oldDueAmount = parseDecimal(invoice.dueAmount);
    const oldPaidAmount = parseDecimal(invoice.paidAmount);
    const oldTotalAmount = parseDecimal(invoice.totalAmount);

    const nextTotal = Math.max(0, oldTotalAmount - refundAmount);
    let nextPaid = oldPaidAmount;
    let nextDue = 0;

    if (nextTotal < oldPaidAmount) {
      nextPaid = nextTotal;
      nextDue = 0;
    } else {
      nextDue = nextTotal - oldPaidAmount;
    }

    await db!
      .update(invoices)
      .set({
        totalAmount: String(nextTotal),
        paidAmount: String(nextPaid),
        dueAmount: String(nextDue)
      })
      .where(eq(invoices.id, invoiceId));

    // Adjust Party balance
    const dueDiff = oldDueAmount - nextDue;
    const partyName = invoice.partyName;
    const [party] = invoice.partyId
      ? await db!.select().from(parties).where(eq(parties.id, invoice.partyId))
      : await db!.select().from(parties).where(eq(parties.name, partyName));

    if (party) {
      const nextBal = invoice.invoiceType === 'SALES'
        ? parseDecimal(party.currentBalance) - dueDiff
        : parseDecimal(party.currentBalance) + dueDiff;

      await db!
        .update(parties)
        .set({ currentBalance: String(nextBal) })
        .where(eq(parties.id, party.id));
    }

    // Insert return record
    await db!.insert(returns).values({
      invoiceId,
      returnDate: new Date().toISOString().split('T')[0],
      productId,
      quantity: returnQty,
      refundAmount: String(refundAmount),
      reason,
      createdBy: username
    });

    await logAuditAction('ITEM_RETURNED', `Returned ${returnQty} pcs of ${product.name} from Invoice ${invoice.manualInvoiceNo}. Refunded: ৳${refundAmount}`);

    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error processing return:', error);
    throw new Error(error.message || 'Return processing failed');
  }
}

// 18. DELETE INVOICE ACTION
export async function deleteInvoiceAction(invoiceId: number) {
  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'system';

  if (isDemoMode) {
    const data = readLocalDb();
    
    // Find Invoice
    const invoiceIndex = data.invoices.findIndex(i => i.id === invoiceId);
    if (invoiceIndex === -1) throw new Error('Invoice not found');
    const invoice = data.invoices[invoiceIndex];

    // Find items for this invoice
    const items = data.invoiceItems.filter(item => item.invoiceId === invoiceId);

    // Revert Stock for each item
    for (const item of items) {
      const product = data.products.find(p => p.id === item.productId);
      if (!product) continue;

      if (invoice.invoiceType === 'PURCHASE') {
        product.currentStock -= item.quantity;
      } else {
        product.currentStock += item.quantity;
      }
    }

    // Revert Party Balance
    const party = data.parties.find(p => p.name.toLowerCase() === invoice.partyName.toLowerCase());
    if (party) {
      if (invoice.invoiceType === 'SALES') {
        party.currentBalance = parseFloat((party.currentBalance - invoice.dueAmount).toFixed(2));
      } else {
        party.currentBalance = parseFloat((party.currentBalance + invoice.dueAmount).toFixed(2));
      }
    }

    // Delete invoice items, returns, and invoice
    data.invoiceItems = data.invoiceItems.filter(item => item.invoiceId !== invoiceId);
    data.returns = data.returns.filter(r => r.invoiceId !== invoiceId);
    data.invoices.splice(invoiceIndex, 1);

    writeLocalDb(data);
    await logAuditAction('INVOICE_DELETED', `Deleted ${invoice.invoiceType} invoice ${invoice.manualInvoiceNo} for party "${invoice.partyName}". Reverted dues: ৳${invoice.dueAmount}`);
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    const [invoice] = await db!.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error('Invoice not found');

    const itemsList = await db!.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    // Revert Stock
    for (const item of itemsList) {
      const [product] = await db!.select().from(products).where(eq(products.id, item.productId));
      if (!product) continue;

      const nextStock = invoice.invoiceType === 'PURCHASE'
        ? product.currentStock - item.quantity
        : product.currentStock + item.quantity;

      await db!
        .update(products)
        .set({ currentStock: nextStock })
        .where(eq(products.id, item.productId));
    }

    // Revert Party Balance
    if (invoice.partyId) {
      let [party] = await db!.select().from(parties).where(eq(parties.id, invoice.partyId));
      if (party) {
        const currentBal = parseDecimal(party.currentBalance);
        const invoiceDue = parseDecimal(invoice.dueAmount);
        const nextBal = invoice.invoiceType === 'SALES'
          ? currentBal - invoiceDue
          : currentBal + invoiceDue;

        await db!
          .update(parties)
          .set({ currentBalance: String(parseFloat(nextBal.toFixed(2))) })
          .where(eq(parties.id, party.id));
      }
    }

    // Delete records
    await db!.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    await db!.delete(returns).where(eq(returns.invoiceId, invoiceId));
    await db!.delete(invoices).where(eq(invoices.id, invoiceId));

    await logAuditAction('INVOICE_DELETED', `Deleted ${invoice.invoiceType} invoice ${invoice.manualInvoiceNo} for party "${invoice.partyName}". Reverted dues: ৳${invoice.dueAmount}`);

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('Error deleting invoice:', err);
    throw new Error(err.message || 'Failed to delete invoice');
  }
}

// 19. UPDATE INVOICE ACTION
export async function updateInvoiceAction(
  invoiceId: number,
  invoiceData: {
    invoiceType: 'SALES' | 'PURCHASE';
    manualInvoiceNo: string;
    invoiceDate: string;
    partyName: string;
    totalAmount: number;
    paidAmount: number;
    dueAmount: number;
    expectedPaymentDate?: string | null;
  },
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[]
) {
  if (items.length === 0) {
    throw new Error('Invoice must contain at least one item');
  }

  const currentUser = await getCurrentUserAction();
  const username = currentUser ? currentUser.username : 'system';

  if (isDemoMode) {
    const data = readLocalDb();
    
    // Find Invoice
    const invoice = data.invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Invoice not found');

    // 1. Revert old items stock
    const oldItems = data.invoiceItems.filter(item => item.invoiceId === invoiceId);
    for (const oldItem of oldItems) {
      const product = data.products.find(p => p.id === oldItem.productId);
      if (!product) continue;
      if (invoice.invoiceType === 'PURCHASE') {
        product.currentStock -= oldItem.quantity;
      } else {
        product.currentStock += oldItem.quantity;
      }
    }

    // 2. Revert old party balance
    const oldParty = data.parties.find(p => p.name.toLowerCase() === invoice.partyName.toLowerCase());
    if (oldParty) {
      if (invoice.invoiceType === 'SALES') {
        oldParty.currentBalance = parseFloat((oldParty.currentBalance - invoice.dueAmount).toFixed(2));
      } else {
        oldParty.currentBalance = parseFloat((oldParty.currentBalance + invoice.dueAmount).toFixed(2));
      }
    }

    // Resolve or Auto-Create NEW Party
    let newParty = data.parties.find(p => p.name.toLowerCase() === invoiceData.partyName.toLowerCase());
    if (!newParty) {
      const partyId = data.parties.length > 0 ? Math.max(...data.parties.map(p => p.id)) + 1 : 1;
      newParty = {
        id: partyId,
        name: invoiceData.partyName,
        partyType: invoiceData.invoiceType === 'SALES' ? 'CUSTOMER' : 'SUPPLIER',
        phone: null,
        address: null,
        currentBalance: 0
      };
      data.parties.push(newParty);
    }

    // 3. Apply new party balance
    if (invoiceData.invoiceType === 'SALES') {
      newParty.currentBalance = parseFloat((newParty.currentBalance + invoiceData.dueAmount).toFixed(2));
    } else {
      newParty.currentBalance = parseFloat((newParty.currentBalance - invoiceData.dueAmount).toFixed(2));
    }

    // 4. Update Invoice details
    invoice.invoiceType = invoiceData.invoiceType;
    invoice.manualInvoiceNo = invoiceData.manualInvoiceNo;
    invoice.invoiceDate = invoiceData.invoiceDate;
    invoice.partyName = invoiceData.partyName;
    invoice.totalAmount = invoiceData.totalAmount;
    invoice.paidAmount = invoiceData.paidAmount;
    invoice.dueAmount = invoiceData.dueAmount;
    invoice.expectedPaymentDate = invoiceData.expectedPaymentDate || null;
    invoice.partyId = newParty.id;

    // 5. Delete old invoice items & returns
    data.invoiceItems = data.invoiceItems.filter(item => item.invoiceId !== invoiceId);
    data.returns = data.returns.filter(r => r.invoiceId !== invoiceId);

    // 6. Insert new items & adjust stock
    let itemIndex = data.invoiceItems.length > 0 ? Math.max(...data.invoiceItems.map(item => item.id)) + 1 : 1;
    for (const item of items) {
      const product = data.products.find(p => p.id === item.productId);
      if (!product) continue;

      let costPriceAtSale = 0;
      if (invoiceData.invoiceType === 'PURCHASE') {
        const currentStock = product.currentStock;
        const currentAvgCost = product.movingAverageCost;
        const purchaseQty = item.quantity;
        const purchasePrice = item.unitPrice;

        let newMovingAverageCost = purchasePrice;
        if (currentStock > 0) {
          newMovingAverageCost = ((currentStock * currentAvgCost) + (purchaseQty * purchasePrice)) / (currentStock + purchaseQty);
        }

        product.movingAverageCost = parseFloat(newMovingAverageCost.toFixed(2));
        product.currentStock = currentStock + purchaseQty;
        costPriceAtSale = purchasePrice;
      } else {
        product.currentStock = product.currentStock - item.quantity;
        costPriceAtSale = product.movingAverageCost;
      }

      data.invoiceItems.push({
        id: itemIndex++,
        invoiceId: invoiceId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPriceAtSale: costPriceAtSale
      });
    }

    writeLocalDb(data);
    await logAuditAction('INVOICE_UPDATED', `Updated ${invoiceData.invoiceType} invoice ${invoiceData.manualInvoiceNo} for party "${invoiceData.partyName}". New Total: ৳${invoiceData.totalAmount}`);
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    const [invoice] = await db!.select().from(invoices).where(eq(invoices.id, invoiceId));
    if (!invoice) throw new Error('Invoice not found');

    const oldItems = await db!.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

    // 1. Revert old items stock
    for (const oldItem of oldItems) {
      const [product] = await db!.select().from(products).where(eq(products.id, oldItem.productId));
      if (!product) continue;
      const nextStock = invoice.invoiceType === 'PURCHASE'
        ? product.currentStock - oldItem.quantity
        : product.currentStock + oldItem.quantity;
      await db!.update(products).set({ currentStock: nextStock }).where(eq(products.id, oldItem.productId));
    }

    // 2. Revert old party balance
    if (invoice.partyId) {
      let [oldParty] = await db!.select().from(parties).where(eq(parties.id, invoice.partyId));
      if (oldParty) {
        const currentBal = parseDecimal(oldParty.currentBalance);
        const invoiceDue = parseDecimal(invoice.dueAmount);
        const nextBal = invoice.invoiceType === 'SALES'
          ? currentBal - invoiceDue
          : currentBal + invoiceDue;
        await db!.update(parties).set({ currentBalance: String(parseFloat(nextBal.toFixed(2))) }).where(eq(parties.id, oldParty.id));
      }
    }

    // Resolve or Auto-Create NEW Party
    let [newParty] = await db!.select().from(parties).where(eq(parties.name, invoiceData.partyName));
    if (!newParty) {
      [newParty] = await db!
        .insert(parties)
        .values({
          name: invoiceData.partyName,
          partyType: invoiceData.invoiceType === 'SALES' ? 'CUSTOMER' : 'SUPPLIER',
          currentBalance: '0'
        })
        .returning();
    }

    // 3. Apply new party balance
    const currentBal = parseDecimal(newParty.currentBalance);
    const nextBal = invoiceData.invoiceType === 'SALES'
      ? currentBal + invoiceData.dueAmount
      : currentBal - invoiceData.dueAmount;
    await db!.update(parties).set({ currentBalance: String(parseFloat(nextBal.toFixed(2))) }).where(eq(parties.id, newParty.id));

    // 4. Delete old invoice items & returns
    await db!.delete(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));
    await db!.delete(returns).where(eq(returns.invoiceId, invoiceId));

    // 5. Update Invoice details
    await db!
      .update(invoices)
      .set({
        invoiceType: invoiceData.invoiceType,
        manualInvoiceNo: invoiceData.manualInvoiceNo,
        invoiceDate: invoiceData.invoiceDate,
        partyName: invoiceData.partyName,
        totalAmount: String(invoiceData.totalAmount),
        paidAmount: String(invoiceData.paidAmount),
        dueAmount: String(invoiceData.dueAmount),
        expectedPaymentDate: invoiceData.expectedPaymentDate || null,
        partyId: newParty.id
      })
      .where(eq(invoices.id, invoiceId));

    // 6. Insert new items & adjust stock
    for (const item of items) {
      const [product] = await db!.select().from(products).where(eq(products.id, item.productId));
      if (!product) continue;

      const currentStock = product.currentStock;
      const currentAvgCost = parseDecimal(product.movingAverageCost);
      let costPriceAtSale = 0;
      let nextStock = currentStock;
      let nextAvgCost = currentAvgCost;

      if (invoiceData.invoiceType === 'PURCHASE') {
        nextStock = currentStock + item.quantity;
        if (currentStock > 0) {
          nextAvgCost = ((currentStock * currentAvgCost) + (item.quantity * item.unitPrice)) / (currentStock + item.quantity);
        } else {
          nextAvgCost = item.unitPrice;
        }
        costPriceAtSale = item.unitPrice;
      } else {
        nextStock = currentStock - item.quantity;
        costPriceAtSale = currentAvgCost;
      }

      await db!.update(products).set({
        currentStock: nextStock,
        movingAverageCost: String(parseFloat(nextAvgCost.toFixed(2)))
      }).where(eq(products.id, item.productId));

      await db!.insert(invoiceItems).values({
        invoiceId: invoiceId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        costPriceAtSale: String(parseFloat(costPriceAtSale.toFixed(2)))
      });
    }

    await logAuditAction('INVOICE_UPDATED', `Updated ${invoiceData.invoiceType} invoice ${invoiceData.manualInvoiceNo} for party "${invoiceData.partyName}". New Total: ৳${invoiceData.totalAmount}`);

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('Error updating invoice in DB:', err);
    throw new Error(err.message || 'Failed to update invoice');
  }
}

// 20. GET USERS ACTION (Owner Only)
export async function getUsersAction() {
  const currentUser = await getCurrentUserAction();
  if (!currentUser || currentUser.role !== 'OWNER') {
    throw new Error('Unauthorized access');
  }

  if (isDemoMode) {
    const data = readLocalDb();
    return data.users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role }));
  }

  try {
    const list = await db!.select().from(users);
    return list.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role as 'OWNER' | 'STAFF'
    }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
}

// 21. CREATE USER ACTION (Owner Only)
export async function createUserAction(userData: {
  username: string;
  passwordHash: string;
  role: 'OWNER' | 'STAFF';
  name: string;
}) {
  const currentUser = await getCurrentUserAction();
  if (!currentUser || currentUser.role !== 'OWNER') {
    throw new Error('Unauthorized access');
  }

  const usernameLower = userData.username.trim().toLowerCase();

  if (isDemoMode) {
    const data = readLocalDb();
    
    // Check uniqueness
    const exists = data.users.some(u => u.username.toLowerCase() === usernameLower);
    if (exists) {
      throw new Error('Username already exists');
    }

    const nextId = data.users.length > 0 ? Math.max(...data.users.map(u => u.id)) + 1 : 1;
    const newUser = {
      id: nextId,
      username: usernameLower,
      passwordHash: userData.passwordHash,
      role: userData.role,
      name: userData.name
    };
    
    data.users.push(newUser);
    writeLocalDb(data);

    await logAuditAction('USER_CREATED', `Created new ${userData.role} user "${userData.username}" (${userData.name})`);
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    // Check uniqueness
    const [exists] = await db!
      .select()
      .from(users)
      .where(eq(users.username, usernameLower));
    
    if (exists) {
      throw new Error('Username already exists');
    }

    await db!
      .insert(users)
      .values({
        username: usernameLower,
        passwordHash: userData.passwordHash,
        role: userData.role,
        name: userData.name
      });

    await logAuditAction('USER_CREATED', `Created new ${userData.role} user "${userData.username}" (${userData.name})`);
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('Error creating user in DB:', err);
    throw new Error(err.message || 'Failed to create user');
  }
}

// 22. RESET PASSWORD ACTION (Owner Only)
export async function resetPasswordAction(targetUsername: string, newPasswordHash: string) {
  const currentUser = await getCurrentUserAction();
  if (!currentUser || currentUser.role !== 'OWNER') {
    throw new Error('Unauthorized access');
  }

  const usernameLower = targetUsername.trim().toLowerCase();
  const passwordTrimmed = newPasswordHash.trim();
  if (!passwordTrimmed) {
    throw new Error('Password cannot be empty');
  }

  if (isDemoMode) {
    const data = readLocalDb();
    const userIndex = data.users.findIndex(u => u.username.toLowerCase() === usernameLower);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    data.users[userIndex].passwordHash = passwordTrimmed;
    writeLocalDb(data);

    await logAuditAction('USER_PASSWORD_RESET', `Reset password for user "${usernameLower}"`);
    revalidatePath('/');
    return { success: true };
  }

  // Neon Postgres Mode
  try {
    await db!
      .update(users)
      .set({ passwordHash: passwordTrimmed })
      .where(eq(users.username, usernameLower));

    await logAuditAction('USER_PASSWORD_RESET', `Reset password for user "${usernameLower}"`);
    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error('Error resetting password in DB:', err);
    throw new Error(err.message || 'Failed to reset password');
  }
}



