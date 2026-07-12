import { pgTable, serial, varchar, integer, decimal, date, index, text, timestamp } from 'drizzle-orm/pg-core';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  category: varchar('category', { length: 255 }).notNull(),
  currentStock: integer('current_stock').default(0).notNull(),
  minStockAlert: integer('min_stock_alert').default(0).notNull(),
  movingAverageCost: decimal('moving_average_cost', { precision: 12, scale: 2 }).default('0.00').notNull(),
  barcode: varchar('barcode', { length: 100 }),
  imageUrl: varchar('image_url', { length: 500 }),
}, (table) => [
  index('products_name_idx').on(table.name),
  index('products_barcode_idx').on(table.barcode),
]);

// Product variants — e.g. LED Bulb → 5W, 9W, 12W
export const productVariants = pgTable('product_variants', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(), // e.g. "5W", "Red", "48 inch"
  currentStock: integer('current_stock').default(0).notNull(),
  minStockAlert: integer('min_stock_alert').default(0).notNull(),
  movingAverageCost: decimal('moving_average_cost', { precision: 12, scale: 2 }).default('0.00').notNull(),
  barcode: varchar('barcode', { length: 100 }),
  imageUrl: varchar('image_url', { length: 500 }),
}, (table) => [
  index('variants_product_idx').on(table.productId),
]);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull(), // 'OWNER' or 'STAFF'
  name: varchar('name', { length: 100 }).notNull(),
});

export const parties = pgTable('parties', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).unique().notNull(),
  partyType: varchar('party_type', { length: 20 }).notNull(), // 'CUSTOMER' or 'SUPPLIER'
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  currentBalance: decimal('current_balance', { precision: 12, scale: 2 }).default('0.00').notNull(),
}, (table) => [
  index('parties_type_idx').on(table.partyType),
]);

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  invoiceType: varchar('invoice_type', { length: 20 }).notNull(), // 'SALES' or 'PURCHASE'
  manualInvoiceNo: varchar('manual_invoice_no', { length: 100 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  partyName: varchar('party_name', { length: 255 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  dueAmount: decimal('due_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  expectedPaymentDate: date('expected_payment_date'),
  createdBy: varchar('created_by', { length: 50 }),
  partyId: integer('party_id').references(() => parties.id),
}, (table) => [
  index('invoices_manual_no_idx').on(table.manualInvoiceNo),
  index('invoices_date_idx').on(table.invoiceDate),
]);

export const invoiceItems = pgTable('invoice_items', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  variantId: integer('variant_id').references(() => productVariants.id), // null = no variant
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  costPriceAtSale: decimal('cost_price_at_sale', { precision: 12, scale: 2 }).default('0.00').notNull(),
});

export const expenses = pgTable('expenses', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull(),
  createdBy: varchar('created_by', { length: 50 }),
}, (table) => [
  index('expenses_date_idx').on(table.date),
]);

export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  returnDate: date('return_date').notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  refundAmount: decimal('refund_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  reason: varchar('reason', { length: 255 }),
  createdBy: varchar('created_by', { length: 50 }),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 50 }).notNull(),
  action: varchar('action', { length: 255 }).notNull(),
  details: text('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
