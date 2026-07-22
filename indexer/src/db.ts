import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.dbUrl });

export async function runMigrations(): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migDir = path.resolve(__dirname, '../db/migrations');
  const files = (await fs.readdir(migDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migDir, file), 'utf8');
    await pool.query(sql);
    console.log(`[db] applied ${file}`);
  }
}

// Cursor management

export async function loadCursor(): Promise<{ lastBlock: bigint; lastState: string | null }> {
  const { rows } = await pool.query<{ last_block: string; last_state: string | null }>(
    'SELECT last_block, last_state FROM indexer_cursor WHERE id = 1',
  );
  return { lastBlock: BigInt(rows[0]?.last_block ?? 0), lastState: rows[0]?.last_state ?? null };
}

export async function saveCursor(lastBlock: bigint, lastState: string): Promise<void> {
  await pool.query(
    `UPDATE indexer_cursor SET last_block = $1, last_state = $2, updated_at = NOW() WHERE id = 1`,
    [lastBlock.toString(), lastState],
  );
}
