import { NextRequest, NextResponse } from 'next/server';
import { db, isDemoMode } from '@/lib/db';
import { invoiceItems, productVariants, products, invoices } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  if (isDemoMode) {
    return NextResponse.json({ error: 'Running in demo mode, no Neon DB connection.' });
  }

  try {
    const items = await db!
      .select({
        id: invoiceItems.id,
        invoiceId: invoiceItems.invoiceId,
        productId: invoiceItems.productId,
        variantId: invoiceItems.variantId,
        quantity: invoiceItems.quantity,
        unitPrice: invoiceItems.unitPrice,
        productName: products.name,
        invoiceType: invoices.invoiceType,
        invoiceNo: invoices.manualInvoiceNo
      })
      .from(invoiceItems)
      .innerJoin(products, eq(invoiceItems.productId, products.id))
      .innerJoin(invoices, eq(invoiceItems.invoiceId, invoices.id))
      .orderBy(desc(invoiceItems.id))
      .limit(30);

    const variants = await db!
      .select()
      .from(productVariants)
      .limit(30);

    return NextResponse.json({
      invoiceItems: items,
      productVariants: variants
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
