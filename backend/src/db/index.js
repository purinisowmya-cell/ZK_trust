import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { newDb } from 'pg-mem';
import { config } from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let poolInstance = null;
let isInMemory = false;

/**
 * Initializes the database connection and creates required tables.
 */
export async function initDatabase() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  if (config.databaseUrl) {
    try {
      console.log('Connecting to PostgreSQL database...');
      const { Pool } = pg;
      const pool = new Pool({ connectionString: config.databaseUrl });
      // Test connection
      await pool.query('SELECT 1');
      console.log('Connected to external PostgreSQL successfully.');
      await pool.query(schemaSql);
      console.log('Database tables migrated successfully.');
      poolInstance = pool;
      isInMemory = false;
      return;
    } catch (err) {
      console.warn('Failed to connect to PostgreSQL, falling back to embedded pg-mem store:', err.message);
    }
  }

  // Fallback / Default: Embedded in-memory Postgres emulator (pg-mem)
  console.log('Initializing embedded in-memory PostgreSQL engine (pg-mem)...');
  const db = newDb();
  
  // Register custom Postgres functions if needed
  db.public.none(schemaSql);

  const { Pool } = db.adapters.createPg();
  poolInstance = new Pool();
  isInMemory = true;
  console.log('Embedded database initialized and schema applied successfully.');
}

/**
 * Executes a parameterized SQL query.
 */
export async function query(text, params = []) {
  if (!poolInstance) {
    await initDatabase();
  }
  return poolInstance.query(text, params);
}

/**
 * Returns whether the database is running in-memory or on external Postgres.
 */
export function isUsingInMemoryDb() {
  return isInMemory;
}
