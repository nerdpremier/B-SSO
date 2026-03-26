import '../startup-check.js';
import pkg from 'pg';
const { Pool } = pkg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
    console.error(JSON.stringify({
        event: 'DB_POOL_ERROR',
        ts: new Date().toISOString(),
        error: err.message,
        code: err.code,
    }));
});
