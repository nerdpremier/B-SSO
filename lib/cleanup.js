// ============================================================
// 🧹 cleanup.js (lib) — Reusable DB Cleanup Utility
//
// ส่งออกเฉพาะ runCleanup() function
// HTTP handler อยู่ที่ api/cleanup.js
// ============================================================
import { pool } from './db.js';

/**
 * ลบ rows เก่าที่ไม่จำเป็นออกจาก DB
 *
 * Tables:
 *   rate_limit_events    — events เก่ากว่า 2 ชั่วโมง
 *   revoked_tokens       — JWT ที่ expires_at < NOW()
 *   sso_tokens           — one-time token ที่ expires_at < NOW()
 *   oauth_codes          — codes ที่หมดอายุ (ทั้งที่ใช้แล้วและยังไม่ได้ใช้)
 *   oauth_tokens         — access/refresh tokens ที่หมดอายุ
 *   email_verifications  — verification tokens ที่หมดอายุ
 *   login_risks (partial) — successful attempts เก่ากว่า 24 ชั่วโมง, failed attempts เก่ากว่า 7 วัน
 *
 * @returns {Promise<object>} จำนวน rows ที่ลบแต่ละ table
 */
export async function runCleanup() {
    // [FIX] ใช้ pool.query() แทน client + Promise.all บน connection เดียว
    // Promise.all กับ client ตัวเดียว: node-postgres queue queries ไว้ ไม่ได้ parallel จริง
    // ถ้า query หนึ่ง reject, Promise.all reject ทันทีแต่ queries ที่ queue ไว้อาจยังวิ่งอยู่
    // pool.query() แต่ละตัวใช้ connection แยก → parallel จริง + error isolation ดีกว่า
    const [rl, rt, sso, oc, ot, ev, lr] = await Promise.all([
        pool.query(`
            DELETE FROM rate_limit_events
            WHERE created_at < NOW() - INTERVAL '2 hours'
        `),
        pool.query(`
            DELETE FROM revoked_tokens
            WHERE expires_at < NOW()
        `),
        pool.query(`
            DELETE FROM sso_tokens
            WHERE expires_at < NOW()
        `),
        pool.query(`
            DELETE FROM oauth_codes
            WHERE expires_at < NOW()
        `),
        pool.query(`
            DELETE FROM oauth_tokens
            WHERE expires_at < NOW()
        `),
        pool.query(`
            DELETE FROM email_verifications
            WHERE expires_at < NOW()
        `),
        pool.query(`
            DELETE FROM login_risks
            WHERE (created_at < NOW() - INTERVAL '24 hours' AND is_success = TRUE)
               OR (created_at < NOW() - INTERVAL '7 days')
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
}

