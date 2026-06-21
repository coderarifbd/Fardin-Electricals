import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url || url.includes('placeholder')) {
  console.error('Error: Please set a valid DATABASE_URL in environment variables.');
  process.exit(1);
}

const client = neon(url);
const db = drizzle(client, { schema });

async function main() {
  console.log('Seeding database...');
  try {
    // Check if users already exist
    const existingUsers = await db.select().from(schema.users);
    if (existingUsers.length > 0) {
      console.log('Database already has users. Skipping seed.');
      return;
    }

    // Insert Default Users
    console.log('Inserting default users...');
    await db.insert(schema.users).values([
      {
        id: 1,
        username: 'owner',
        passwordHash: 'owner123',
        role: 'OWNER',
        name: 'Al-Haj Rafiqul Islam'
      },
      {
        id: 2,
        username: 'staff',
        passwordHash: 'staff123',
        role: 'STAFF',
        name: 'Md. Karim'
      }
    ]);

    // Insert Default Products
    console.log('Inserting default products...');
    await db.insert(schema.products).values([
      { id: 1, name: 'LED Bulb 12W Havells', category: 'Lighting', currentStock: 45, minStockAlert: 15, movingAverageCost: '120.00', barcode: '8901234567891' },
      { id: 2, name: 'Polycab Wire 1.5 sqmm (90m)', category: 'Cables', currentStock: 12, minStockAlert: 5, movingAverageCost: '1850.00', barcode: '8901234567892' },
      { id: 3, name: 'Piano Switch 6A Anchor', category: 'Switches', currentStock: 150, minStockAlert: 50, movingAverageCost: '18.00', barcode: '8901234567893' },
      { id: 4, name: 'Socket 5-Pin Anchor', category: 'Switches', currentStock: 80, minStockAlert: 30, movingAverageCost: '35.00', barcode: '8901234567894' },
      { id: 5, name: 'Orient Ceiling Fan 48 inch', category: 'Fans', currentStock: -2, minStockAlert: 4, movingAverageCost: '2400.00', barcode: '8901234567895' },
      { id: 6, name: 'PVC Electrical Tape Black', category: 'Accessories', currentStock: 0, minStockAlert: 10, movingAverageCost: '12.00', barcode: '8901234567896' }
    ]);

    // Insert Default Parties
    console.log('Inserting default parties...');
    await db.insert(schema.parties).values([
      { id: 1, name: 'Polycab Distributors Ltd.', partyType: 'SUPPLIER', phone: '01711122233', address: 'Nawabpur, Dhaka', currentBalance: '-2200.00' },
      { id: 2, name: 'Kabir Rahman', partyType: 'CUSTOMER', phone: '01822233344', address: 'Mirpur-10, Dhaka', currentBalance: '1800.00' },
      { id: 3, name: 'Mizanur Rahman', partyType: 'CUSTOMER', phone: '01933344455', address: 'Dhanmondi, Dhaka', currentBalance: '0.00' }
    ]);

    // Insert System Logs
    console.log('Inserting initial audit log...');
    await db.insert(schema.auditLogs).values({
      username: 'system',
      action: 'SYSTEM_INIT',
      details: 'Database initialized successfully on Neon PostgreSQL'
    });

    console.log('Database successfully seeded!');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

main();
