import { pool } from './db.js';

export async function runCleanup() {
    const client = await pool.connect();
    try {
        const [rl, rt, sso, oc, ot, ev, lr] = await Promise.all([
            client.query(`
                DELETE FROM rate_limit_events
                WHERE created_at < NOW() - INTERVAL '2 hours'
            `),
            client.query(`
                DELETE FROM revoked_tokens
                WHERE expires_at < NOW()
            `),
            client.query(`
                DELETE FROM sso_tokens
                WHERE expires_at < NOW()
            `),
            client.query(`
                DELETE FROM oauth_codes
                WHERE expires_at < NOW() AND used = TRUE
            `),
            client.query(`
                DELETE FROM oauth_tokens
                WHERE expires_at < NOW()
            `),
            client.query(`
                DELETE FROM email_verifications
                WHERE expires_at < NOW()
            `),
            client.query(`
                DELETE FROM login_risks
                WHERE created_at < NOW() - INTERVAL '24 hours'
                  AND is_success = TRUE
            `),
        ]);

        return {
            rateLimit:          rl.rowCount,
            revokedTokens:      rt.rowCount,
            ssoTokens:          sso.rowCount,
            oauthCodes:         oc.rowCount,
            oauthTokens:        ot.rowCount,
            emailVerifications: ev.rowCount,
            loginRisks:         lr.rowCount,
        };
    } finally {
        client.release();
    }
}
