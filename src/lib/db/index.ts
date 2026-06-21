import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
export const isDemoMode = !url || url.includes('placeholder') || url.includes('ep-cool-breeze-123456');

// Initialize Neon Client
const client = isDemoMode ? null : neon(url!);
export const db = isDemoMode ? null : drizzle(client!, { schema });
