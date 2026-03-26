import { pool } from './db.js';

export async function validateRedirectBack(redirectBack) {
    if (!redirectBack || typeof redirectBack !== 'string' || redirectBack.length > 512) {
        return false;
    }
    try {
        const result = await pool.query(
            'SELECT 1 FROM oauth_clients WHERE $1 = ANY(redirect_uris)',
            [redirectBack]
        );
        return result.rows.length > 0;
    } catch (dbErr) {
        console.error('[WARN] validateRedirectBack DB error:', dbErr.message);
        return false;
    }
}
