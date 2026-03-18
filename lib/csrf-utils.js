// ============================================================
// จัดการการป้องกัน CSRF ด้วยระบบ Double-Submit Cookie
// สร้างและตรวจสอบ token เพื่อยืนยันว่า request มาจากผู้ใช้จริง
//
// จุดเด่น:
//   - ใช้ HMAC-SHA256 เพื่อความปลอดภัยสูง
//   - ไม่ต้องเก็บข้อมูลในฐานข้อมูล (stateless)
//   - ป้องกันการโจมตีจาก subdomain XSS
// ============================================================
import crypto from 'crypto';
import { parse } from 'cookie';

// อ่านค่า CSRF_SECRET ตอนโหลด module (เพื่อประสิทธิภาพ)
// ถูกต้องสำหรับ serverless: cold start ครั้งเดียว warm instance ใช้ต่อ
// startup-check.js ตรวจแล้วว่า CSRF_SECRET ต้องมีค่า
const CSRF_SECRET = process.env.CSRF_SECRET;

// SHA-256 output = 32 bytes = 64 hex chars
// crypto.randomBytes(32) = 32 bytes = 64 hex chars
// ทั้ง nonce และ sig ต้องยาว 64 chars พอดี
const EXPECTED_TOKEN_PART_LENGTH = 64;

// ตรวจ hex format ก่อน Buffer.from():
//   Buffer.from('ZZZ...', 'hex') คืน empty buffer (length 0)
//   timingSafeEqual(Buffer(0), Buffer(0)) === true → bypass ได้
//   HEX_REGEX ป้องกัน non-hex string เข้า Buffer.from()
const HEX_REGEX = /^[0-9a-f]+$/i;

/**
 * สร้าง CSRF token ใหม่ในรูปแบบ "<nonce>.<signature>"
 * throw ถ้า CSRF_SECRET ไม่ถูกตั้งค่า (startup-check.js ป้องกันแล้ว แต่ defense-in-depth)
 * @returns {string}
 */
export function generateCsrfToken() {
    if (!CSRF_SECRET) throw new Error('[CONFIG] CSRF_SECRET environment variable is not set');
    const nonce = crypto.randomBytes(32).toString('hex'); // 64 hex chars
    const sig   = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex'); // 64 hex chars
    return `${nonce}.${sig}`;
}

/**
 * ตรวจสอบ CSRF token จาก request
 * ต้องผ่านทุก check ตามลำดับ:
 *   1. cookie และ header ต้องมีค่า
 *   2. cookie === header (double-submit check)
 *   3. split ได้ 2 ส่วน
 *   4. nonce และ sig ยาว 64 chars พอดี (ป้องกัน CPU abuse)
 *   5. nonce และ sig เป็น hex ล้วน (ป้องกัน empty buffer bypass)
 *   6. HMAC(nonce) === sig ด้วย timingSafeEqual
 *
 * @param {import('http').IncomingMessage} req
 * @returns {boolean}
 */
// ตรวจสอบ CSRF token จาก request ของผู้ใช้
export function validateCsrfToken(req) {
    if (!CSRF_SECRET) {
        console.error('[CONFIG] CSRF_SECRET environment variable is not set');
        return false;
    }

    const cookies     = parse(req.headers.cookie || '');
    const cookieToken = cookies.csrf_token;
    const headerToken = req.headers['x-csrf-token'];

    // cookie หรือ header ไม่มีค่า → reject ทันที
    if (!cookieToken || !headerToken) return false;
    // typeof guard: cookie package คืน string เสมอ แต่ defense-in-depth
    // ป้องกัน unexpected behavior ถ้ามีการ patch หรือ mock ใน test
    if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') return false;

    // ── Double-submit check ──────────────────────────────────
    // cookie ต้องตรงกับ header ก่อน:
    //   cross-site request จะไม่มี cookie value (SameSite: strict)
    //   แต่ถ้ามีการ leak cookie ไปยัง header ไม่ได้โดยไม่มี JS access
    if (cookieToken !== headerToken) return false;

    // ── Parse token format ───────────────────────────────────
    const parts = cookieToken.split('.');
    if (parts.length !== 2) return false;
    const [nonce, sig] = parts;

    // ── Length validation (ก่อน HMAC compute) ───────────────
    // ตรวจก่อน HMAC เพื่อไม่เสีย CPU ถ้า token format ผิด
    // ป้องกัน CPU abuse: nonce ยาวมาก → HMAC.update() ทำงานนานขึ้น
    //   (attacker ต้องผ่าน double-submit check ก่อน จึงต้องมี XSS access)
    //   (แต่ defense-in-depth เพื่อลด blast radius ถ้า double-submit bypass ได้)
    if (nonce.length !== EXPECTED_TOKEN_PART_LENGTH || sig.length !== EXPECTED_TOKEN_PART_LENGTH) {
        return false;
    }

    // ── Hex format validation (ก่อน Buffer.from) ────────────
    // Buffer.from('ZZZ', 'hex') คืน empty Buffer (length 0) โดยไม่ throw
    // timingSafeEqual(Buffer(0), Buffer(0)) === true → bypass ได้ถ้าไม่ตรวจ
    // ตรวจ nonce และ sig เท่านั้น: expectedSig มาจาก HMAC output ซึ่งเป็น hex เสมอ
    if (!HEX_REGEX.test(nonce) || !HEX_REGEX.test(sig)) return false;

    // ── HMAC verification ────────────────────────────────────
    // คำนวณ expected signature จาก nonce ที่ผ่าน validation แล้ว
    const expectedSig = crypto.createHmac('sha256', CSRF_SECRET).update(nonce).digest('hex');

    const sigBuf      = Buffer.from(sig,         'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');

    // length check ก่อน timingSafeEqual: throw ถ้า buffer ยาวไม่เท่ากัน
    // ในทางปฏิบัติเป็นไปไม่ได้เพราะทั้งสองผ่าน length + hex check แล้ว
    // แต่ defense-in-depth ป้องกัน API contract เปลี่ยนในอนาคต
    if (sigBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expectedBuf);
}
