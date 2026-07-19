// db.js — PostgreSQL connection pool
require('dotenv').config();
const { Pool } = require('pg');

// Use DATABASE_URL (Neon/Render production) or fall back to individual PG vars (local dev)
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // required for Neon SSL
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  // Never crash the whole process on an idle client error
  console.error('Unexpected PG pool error', err);
});

// Always prefer parameterized queries ($1, $2, ...) — never string-concatenate
// user input into SQL. Every query in this project uses the pattern below.
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    console.log('executed query', { text, duration: Date.now() - start, rows: res.rowCount });
  }
  return res;
}

async function getClient() {
  // For multi-statement transactions (BEGIN/COMMIT/ROLLBACK)
  const client = await pool.connect();
  return client;
}

module.exports = { pool, query, getClient };
