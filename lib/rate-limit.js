import '../startup-check.js';
import { pool } from './db.js';

export async function checkRateLimit(key, maxCount, windowMs) {
    if (!key || typeof key !== 'string') {
        throw new Error(`[rate-limit] key invalid: ${key}`);
    }
    const windowSec = Math.ceil(windowMs / 1000);
    if (!Number.isFinite(windowSec) || windowSec <= 0) {
        throw new Error(`[rate-limit] windowMs invalid: ${windowMs}`);
    }
    if (!Number.isFinite(maxCount) || !Number.isInteger(maxCount) || maxCount <= 0) {
        throw new Error(`[rate-limit] maxCount invalid: ${maxCount}`);
    }
    const result = await pool.query(
        `WITH current_count AS (
             SELECT COUNT(*) AS cnt
             FROM rate_limit_events
             WHERE key = $1
               AND created_at > NOW() - make_interval(secs => $2)
         ),
         new_event AS (
             INSERT INTO rate_limit_events (key)
             SELECT $1
             WHERE (SELECT cnt FROM current_count) < $3
         )
         SELECT (SELECT cnt FROM current_count) AS count`,
        [key, windowSec, maxCount]
    );
    const currentCount = Number(result.rows[0].count);
    if (Math.random() < 0.01) {
        pool.query("DELETE FROM rate_limit_events WHERE created_at < NOW() - INTERVAL '2 hours'")
            .catch(err => console.error('[WARN] rate_limit_events cleanup error:', err.message));
    }
    return currentCount >= maxCount;
}
