import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
    pool.on('error', (err) => console.error('DB pool error:', err.message));
  }
  return pool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

export async function queryOne(text, params) {
  const res = await query(text, params);
  return res.rows[0] || null;
}

export async function queryAll(text, params) {
  const res = await query(text, params);
  return res.rows;
}

export async function initSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await getPool().query(sql);
  console.log('[db] Schema initialized');
}
